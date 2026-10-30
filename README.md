# CouchCrew

Watch movies/shows together with people who aren't in the room with you —
synced playback, group chat, mic/cam, and screen share, all in one link.
Built for TCSS 490 Artifact 4 ("For Someone Else").

## What it does (target scope)

- Join a room by code or link — any number of people
- Text chat
- Mic/camera for anyone who opts in
- Screen share (also the fallback for watching non-YouTube sources together)
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

To test video/screen-share locally, the server also needs a `DAILY_API_KEY`
env var (a free Daily.co account's API key) — set it in `server/.env` or
export it before `npm run dev`. Without it, `/daily/room` returns a clear
500 error instead of silently failing.

## Live

- Frontend: https://couch-crew.vercel.app
- Backend: https://couchcrew.onrender.com (free tier — spins down when idle,
  first request after inactivity can take 30-60s)

## Status

Deployed. Room join, chat, and the realtime backbone work end to end in
production. Video/screen-share (Daily.co) and synced YouTube playback are
not yet integrated — see `CLAUDE.md` for the job split.
