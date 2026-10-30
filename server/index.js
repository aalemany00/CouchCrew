import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;

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

// Maps a CouchCrew roomId to a Daily.co video room, creating one on first
// use. The Daily API key stays server-side only — Job 2 (VideoPanel) calls
// this instead of talking to Daily's room-management API directly.
const DAILY_API_KEY = process.env.DAILY_API_KEY;
const dailyRoomUrlByRoomId = new Map();

app.post("/daily/room", async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) {
    return res.status(400).json({ error: "roomId is required" });
  }
  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: "DAILY_API_KEY is not configured on the server" });
  }

  const cached = dailyRoomUrlByRoomId.get(roomId);
  if (cached) return res.json({ url: cached });

  const dailyRoomName = `couchcrew-${roomId}`;
  const authHeader = { Authorization: `Bearer ${DAILY_API_KEY}` };

  try {
    // A server restart loses the in-memory cache above, so check whether
    // Daily already has this room before trying to create it again.
    const existing = await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
      headers: authHeader,
    });
    if (existing.ok) {
      const data = await existing.json();
      dailyRoomUrlByRoomId.set(roomId, data.url);
      return res.json({ url: data.url });
    }

    const created = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: dailyRoomName,
        properties: {
          // Auto-expire 6 hours after creation so stale rooms don't pile up
          // in the Daily dashboard.
          exp: Math.round(Date.now() / 1000) + 6 * 60 * 60,
        },
      }),
    });

    if (!created.ok) {
      const errText = await created.text();
      return res.status(502).json({ error: `Daily API error: ${errText}` });
    }

    const data = await created.json();
    dailyRoomUrlByRoomId.set(roomId, data.url);
    res.json({ url: data.url });
  } catch (err) {
    res.status(500).json({ error: "Failed to reach Daily API" });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins },
});

// roomId -> Map<socketId, { name }>
const rooms = new Map();

function getRoomMembers(roomId) {
  const members = rooms.get(roomId);
  if (!members) return [];
  return Array.from(members.entries()).map(([id, info]) => ({ id, ...info }));
}

io.on("connection", (socket) => {
  let joinedRoomId = null;

  socket.on("room:join", ({ roomId, name }) => {
    joinedRoomId = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.id, { name: name || "Guest" });

    socket.emit("room:joined", { roomId, members: getRoomMembers(roomId) });
    socket.to(roomId).emit("room:presence", { members: getRoomMembers(roomId) });
  });

  socket.on("chat:message", ({ roomId, text }) => {
    if (!roomId || !text) return;
    const member = rooms.get(roomId)?.get(socket.id);
    io.to(roomId).emit("chat:message", {
      id: socket.id,
      name: member?.name || "Guest",
      text,
      at: Date.now(),
    });
  });

  // Generic sync-event relay for the watch party player (Job 3 builds on this).
  // event examples: { type: "play" | "pause" | "seek" | "load", payload }
  socket.on("sync:event", ({ roomId, event }) => {
    if (!roomId || !event) return;
    socket.to(roomId).emit("sync:event", event);
  });

  socket.on("disconnect", () => {
    if (!joinedRoomId) return;
    const members = rooms.get(joinedRoomId);
    if (members) {
      members.delete(socket.id);
      if (members.size === 0) rooms.delete(joinedRoomId);
    }
    socket.to(joinedRoomId).emit("room:presence", { members: getRoomMembers(joinedRoomId) });
  });
});

httpServer.listen(PORT, () => {
  console.log(`CouchCrew server listening on :${PORT}`);
});
