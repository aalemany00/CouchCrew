# CouchCrew

Watch movies/shows together with people who aren't in the room with you —
synced playback, group chat, mic/cam, and screen share, all in one link.
Built for TCSS 490 Artifact 4 ("For Someone Else").

## What it does (target scope)

- Join a room by code or link — any number of people
- Text chat, with history for anyone who joins mid-conversation
- Mic/camera for anyone who opts in, screen share for everyone else to see
- Synced YouTube playback — play/pause/seek broadcasts to the whole room
- Works on a phone browser, no app install needed

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, scope boundaries,
and the three-way job split, and [`LOG.md`](./LOG.md) for the plans/changes
log.

## Project structure

```
client/   React + Vite frontend
server/   Node + Express + Socket.IO backend (rooms, chat, sync relay)
```

## Running locally

```bash
# backend
cd server
npm install
npm run dev        # http://localhost:3001

# frontend (separate terminal)
cd client
npm install
cp .env.example .env
npm run dev         # http://localhost:5173
```

Video/screen-share runs on Jitsi Meet's free public server
(`meet.jit.si`) — no account, API key, or payment method needed, locally
or in production.

## Live

- Frontend: https://couch-crew.vercel.app
- Backend: https://couchcrew.onrender.com (free tier — spins down when idle,
  first request after inactivity can take 30-60s)

## Status

Deployed and all three features work together in production: rooms/chat
with history, video/screen-share via Jitsi, and synced YouTube playback.
See `CLAUDE.md` for the job split and `LOG.md` for what's been built.
