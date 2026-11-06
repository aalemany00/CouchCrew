import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerIceRoute } from "./ice.js";
import { registerArchiveRoutes } from "./archive.js";
import { registerAuthRoutes } from "./auth.js";
import { getUserByToken } from "./db.js";

const PORT = process.env.PORT || 3001;
// Shows a "developer" badge next to this one account's name in every room,
// so it can't just be typed into a display name - the server checks the
// signed-in account behind the socket's own auth token, never anything the
// client claims directly.
const DEVELOPER_EMAIL = "adrian.alemany2@gmail.com";

async function isDeveloperToken(authToken) {
  if (typeof authToken !== "string" || !authToken) return false;
  const account = await getUserByToken(authToken);
  return !!account && account.email.toLowerCase() === DEVELOPER_EMAIL;
}
const MAX_HISTORY = 50;
const MAX_MESSAGE_LENGTH = 500;
// A resized-on-the-client JPEG data URL comfortably fits well under this;
// it's just a sanity cap against someone sending something huge, since
// avatars sit in memory on every member record and get re-broadcast on
// every presence update.
const MAX_AVATAR_LENGTH = 200_000;
const MAX_BIO_LENGTH = 160;
// Past this, video call quality degrades badly (per real testing - cameras
// stutter above 4-5 people) well before Cloudflare TURN cost is a real
// concern. See LOG.md for the bandwidth math.
const MAX_ROOM_SIZE = 5;

// Comma-separated list of allowed frontend origins, e.g.
// "https://couchcrew.vercel.app,http://localhost:5173". Defaults to "*" so
// local dev keeps working with no setup.
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
  : "*";

const app = express();
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Lets the client check whether a custom room code is already taken before
// creating a room with it (rooms only "exist" here once someone has joined
// them - there's no separate reservation step). Used to auto-suffix a
// requested code instead of silently joining someone else's room.
app.get("/api/room-exists/:code", (req, res) => {
  const members = rooms.get(req.params.code.toLowerCase());
  res.json({ exists: !!members && members.size > 0 });
});

registerIceRoute(app);
registerArchiveRoutes(app);
registerAuthRoutes(app);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins },
});

// roomId -> Map<socketId, { name }>
const rooms = new Map();
// roomId -> recent chat/system messages (capped), so someone joining mid-
// conversation isn't dropped into an empty chat panel. Cleared once the
// room empties out, same lifetime as the room itself.
const roomMessages = new Map();
// roomId -> socketId of the current leader. The first person to join an
// empty room becomes its leader; only the leader controls what's playing.
// Lifetime matches the room's — cleared when it empties, same as above.
const roomLeaders = new Map();
// roomId -> genre theme string. Leader-controlled, like the sync-event
// controls; "classic" (the base drive-in look) until the leader changes it.
const roomThemes = new Map();
// roomId -> Set<socketId> of people currently in the video call. Our server
// only passes WebRTC setup messages between them (signaling); the audio/video
// itself flows directly between browsers.
const roomCalls = new Map();
// roomId -> Map<name, Timeout>. A disconnect schedules a delayed "left the
// room" announcement instead of firing it immediately, so a page reload
// (old socket disconnects, new one reconnects almost instantly) doesn't
// read as a real leave - see room:join below, which cancels it on a
// same-name reconnect within the window instead of announcing both a leave
// and a rejoin for what was really just a blip.
const pendingLeaveTimers = new Map();
const RECONNECT_GRACE_MS = 3000;
const VALID_THEMES = new Set([
  "classic",
  "horror",
  "romance",
  "thriller",
  "comedy",
  "scifi",
  "fantasy",
  "action",
]);

function getRoomMembers(roomId) {
  const members = rooms.get(roomId);
  if (!members) return [];
  return Array.from(members.entries()).map(([id, info]) => ({ id, ...info }));
}

function roomState(roomId) {
  return {
    members: getRoomMembers(roomId),
    leaderId: roomLeaders.get(roomId) || null,
    theme: roomThemes.get(roomId) || "classic",
  };
}

function addMessage(roomId, message) {
  if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
  const list = roomMessages.get(roomId);
  list.push(message);
  if (list.length > MAX_HISTORY) list.shift();
  return message;
}

io.on("connection", (socket) => {
  let joinedRoomId = null;

  function leaveCall(roomId) {
    const call = roomCalls.get(roomId);
    if (!call?.delete(socket.id)) return;
    if (call.size === 0) roomCalls.delete(roomId);
    socket.to(roomId).emit("call:peer-left", { id: socket.id });
  }

  socket.on("room:join", async ({ roomId, name, avatar, bio, authToken }) => {
    const existing = rooms.get(roomId);
    if (existing && existing.size >= MAX_ROOM_SIZE && !existing.has(socket.id)) {
      socket.emit("room:full", { roomId, max: MAX_ROOM_SIZE });
      return;
    }

    joinedRoomId = roomId;
    const displayName = (name || "Guest").slice(0, 40);
    const displayAvatar = typeof avatar === "string" && avatar.length <= MAX_AVATAR_LENGTH ? avatar : null;
    const displayBio = typeof bio === "string" ? bio.slice(0, MAX_BIO_LENGTH) : "";
    const isDeveloper = await isDeveloperToken(authToken);
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms
      .get(roomId)
      .set(socket.id, { name: displayName, avatar: displayAvatar, bio: displayBio, isDeveloper });

    // First person into an empty room leads it.
    if (!roomLeaders.has(roomId)) roomLeaders.set(roomId, socket.id);

    socket.emit("room:joined", {
      roomId,
      messages: roomMessages.get(roomId) || [],
      ...roomState(roomId),
    });
    socket.to(roomId).emit("room:presence", roomState(roomId));

    // A reconnect within the grace window (reload, brief network drop) isn't
    // a real departure - cancel the pending "left" message instead of
    // announcing a leave and a rejoin for what was really just a blip.
    const pending = pendingLeaveTimers.get(roomId);
    if (pending?.has(displayName)) {
      clearTimeout(pending.get(displayName));
      pending.delete(displayName);
      if (pending.size === 0) pendingLeaveTimers.delete(roomId);
      return;
    }

    const systemMessage = addMessage(roomId, {
      id: `system-${socket.id}-${Date.now()}`,
      system: true,
      text: `${displayName} joined the room`,
      at: Date.now(),
    });
    socket.to(roomId).emit("chat:message", systemMessage);
  });

  socket.on("chat:message", ({ roomId, text }) => {
    const trimmed = typeof text === "string" ? text.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
    if (!roomId || !trimmed) return;
    const member = rooms.get(roomId)?.get(socket.id);
    // Avatar/bio are snapshotted onto the message at send time (like most
    // chat apps) rather than looked up live from `rooms` when rendered -
    // that still works for history after the sender has left the room, and
    // doesn't retroactively change what an old message shows if they later
    // update their profile.
    const message = addMessage(roomId, {
      id: `${socket.id}-${Date.now()}`,
      senderId: socket.id,
      name: member?.name || "Guest",
      avatar: member?.avatar || null,
      bio: member?.bio || "",
      isDeveloper: !!member?.isDeveloper,
      text: trimmed,
      at: Date.now(),
    });
    io.to(roomId).emit("chat:message", message);
  });

  // Lets someone update their own name/avatar/bio without leaving and
  // rejoining the room - e.g. from the in-room settings drawer. Only ever
  // touches the sender's own member record.
  socket.on("profile:update", ({ roomId, name, avatar, bio }) => {
    const member = rooms.get(roomId)?.get(socket.id);
    if (!member) return;
    if (typeof name === "string" && name.trim()) member.name = name.trim().slice(0, 40);
    if (avatar === null) member.avatar = null;
    else if (typeof avatar === "string" && avatar.length <= MAX_AVATAR_LENGTH) member.avatar = avatar;
    if (typeof bio === "string") member.bio = bio.slice(0, MAX_BIO_LENGTH);
    io.to(roomId).emit("room:presence", roomState(roomId));
  });

  // Generic sync-event relay for the watch party player (Job 3 builds on this).
  // event examples: { type: "play" | "pause" | "seek" | "load", payload }
  socket.on("sync:event", ({ roomId, event }) => {
    if (!roomId || !event) return;
    socket.to(roomId).emit("sync:event", event);
  });

  // Only the current leader can hand leadership to someone else in the room.
  socket.on("leader:transfer", ({ roomId, toSocketId }) => {
    if (!roomId || !toSocketId) return;
    if (roomLeaders.get(roomId) !== socket.id) return;
    if (!rooms.get(roomId)?.has(toSocketId)) return;
    roomLeaders.set(roomId, toSocketId);
    io.to(roomId).emit("room:presence", roomState(roomId));
  });

  // Only the current leader sets the room's genre theme.
  socket.on("theme:set", ({ roomId, theme }) => {
    if (!roomId || !VALID_THEMES.has(theme)) return;
    if (roomLeaders.get(roomId) !== socket.id) return;
    roomThemes.set(roomId, theme);
    io.to(roomId).emit("room:presence", roomState(roomId));
  });

  // Join the room's video call: the joiner gets the list of people already in
  // it and starts a connection to each; they are told about the joiner.
  socket.on("call:join", ({ roomId }) => {
    const member = rooms.get(roomId)?.get(socket.id);
    if (!member) return;
    if (!roomCalls.has(roomId)) roomCalls.set(roomId, new Set());
    const call = roomCalls.get(roomId);
    const peers = Array.from(call)
      .filter((id) => id !== socket.id)
      .map((id) => ({ id, name: rooms.get(roomId)?.get(id)?.name || "Guest" }));
    call.add(socket.id);
    socket.emit("call:peers", { peers });
    socket.to(roomId).emit("call:peer-joined", { id: socket.id, name: member.name });
  });

  socket.on("call:leave", ({ roomId }) => leaveCall(roomId));

  // Relays one WebRTC signaling message (offer/answer/ICE candidate or a small
  // state update) to a single other person who is in the same call.
  socket.on("rtc:signal", ({ roomId, to, data }) => {
    const call = roomCalls.get(roomId);
    if (!call?.has(socket.id) || !call.has(to) || !data) return;
    io.to(to).emit("rtc:signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    if (joinedRoomId) leaveCall(joinedRoomId);
    if (!joinedRoomId) return;
    const members = rooms.get(joinedRoomId);
    const leavingName = members?.get(socket.id)?.name || "Someone";

    if (members) {
      members.delete(socket.id);
      if (members.size === 0) {
        rooms.delete(joinedRoomId);
        roomMessages.delete(joinedRoomId);
        roomLeaders.delete(joinedRoomId);
        roomThemes.delete(joinedRoomId);
        // Cancel every still-pending "left" timer for this room before
        // dropping the map - otherwise an orphaned setTimeout fires later,
        // finds no map entry, and still goes ahead and re-adds a message to
        // (and recreates roomMessages for) a room that's supposedly gone,
        // potentially one a brand-new join has since recreated.
        for (const timer of pendingLeaveTimers.get(joinedRoomId)?.values() || []) {
          clearTimeout(timer);
        }
        pendingLeaveTimers.delete(joinedRoomId);
        return;
      }
      // Leadership follows along if the leader leaves, so the room never
      // gets stuck with no one able to control what's playing.
      if (roomLeaders.get(joinedRoomId) === socket.id) {
        roomLeaders.set(joinedRoomId, members.keys().next().value);
      }
    }

    socket.to(joinedRoomId).emit("room:presence", roomState(joinedRoomId));

    const roomId = joinedRoomId;
    const timer = setTimeout(() => {
      const pending = pendingLeaveTimers.get(roomId);
      pending?.delete(leavingName);
      if (pending?.size === 0) pendingLeaveTimers.delete(roomId);

      const systemMessage = addMessage(roomId, {
        id: `system-${socket.id}-${Date.now()}`,
        system: true,
        text: `${leavingName} left the room`,
        at: Date.now(),
      });
      io.to(roomId).emit("chat:message", systemMessage);
    }, RECONNECT_GRACE_MS);

    if (!pendingLeaveTimers.has(roomId)) pendingLeaveTimers.set(roomId, new Map());
    pendingLeaveTimers.get(roomId).set(leavingName, timer);
  });
});

httpServer.listen(PORT, () => {
  console.log(`CouchCrew server listening on :${PORT}`);
});
