import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerDailyRoutes } from "./daily.js";

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
// use. Implementation lives in daily.js (Job 2) — the API key stays
// server-side only, the client only ever receives the resulting room URL.
registerDailyRoutes(app);

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
