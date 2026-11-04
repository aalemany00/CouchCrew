import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerIceRoute } from "./ice.js";

const PORT = process.env.PORT || 3001;
const MAX_HISTORY = 50;
const MAX_MESSAGE_LENGTH = 500;

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

registerIceRoute(app);

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

  socket.on("room:join", ({ roomId, name }) => {
    joinedRoomId = roomId;
    const displayName = (name || "Guest").slice(0, 40);
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.id, { name: displayName });

    // First person into an empty room leads it.
    if (!roomLeaders.has(roomId)) roomLeaders.set(roomId, socket.id);

    socket.emit("room:joined", {
      roomId,
      messages: roomMessages.get(roomId) || [],
      ...roomState(roomId),
    });
    socket.to(roomId).emit("room:presence", roomState(roomId));

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
    const message = addMessage(roomId, {
      id: `${socket.id}-${Date.now()}`,
      name: member?.name || "Guest",
      text: trimmed,
      at: Date.now(),
    });
    io.to(roomId).emit("chat:message", message);
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
        return;
      }
      // Leadership follows along if the leader leaves, so the room never
      // gets stuck with no one able to control what's playing.
      if (roomLeaders.get(joinedRoomId) === socket.id) {
        roomLeaders.set(joinedRoomId, members.keys().next().value);
      }
    }

    socket.to(joinedRoomId).emit("room:presence", roomState(joinedRoomId));
    const systemMessage = addMessage(joinedRoomId, {
      id: `system-${socket.id}-${Date.now()}`,
      system: true,
      text: `${leavingName} left the room`,
      at: Date.now(),
    });
    socket.to(joinedRoomId).emit("chat:message", systemMessage);
  });
});

httpServer.listen(PORT, () => {
  console.log(`CouchCrew server listening on :${PORT}`);
});
