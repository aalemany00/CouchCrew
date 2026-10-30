# CouchCrew — Context for Claude Code

TCSS 490 Artifact 4 ("For Someone Else"). This file is shared by all three
team members so each person's Claude Code session has the same context — the
agents don't talk to each other, so this document is the thing that keeps
everyone's work compatible.

## What this is

A watch-party site: any number of people join a room link/code and get text
chat, mic/camera, screen share, and synced video playback — built so a
long-distance pair (or any group) can hang out and watch something together
without everyone needing a laptop.

Real target user: Adrian and his long-distance partner, generalized to
"people who want to watch things together but can't be in the same room."

## Scope for this artifact (do not expand without updating this file)

**In scope (must work by Nov 8):**
- Create/join a room by code or link
- Text chat in the room
- Mic/camera for anyone who wants it, via Daily.co
- Screen share
- Synced YouTube playback (play/pause/seek broadcast to everyone in the room)
- Mobile-responsive (phone browser, not a native app)

**Researched, not guaranteed:** true synced playback for Netflix/Hulu/etc.
(DRM blocks screen-capture-based sync and there's no public cross-user API).
If the research spike (see Job 3) finds nothing workable, the screen-share
feature from Job 2 is the fallback for "watch anything together."

**Explicitly out of scope for this artifact:** native mobile app, "everyone
watches their own thing and opts into a shared watch" mode — both are
possible future work, not required here.

## Architecture

- `client/` — React + Vite frontend. Deployed as a static site (Vercel/Netlify).
- `server/` — Node + Express + Socket.IO backend. Deployed where websockets
  persist (Render/Railway, not Vercel serverless). Owns: room membership,
  chat relay, and a generic `sync:event` relay that the watch player uses to
  broadcast play/pause/seek.
- Mic/camera/screen share do **not** go through our Socket.IO server — Daily.co
  is a managed WebRTC service the client talks to directly. Our server only
  needs to hand out/confirm room membership; Daily.co handles the actual
  media connections.

## The three jobs

Each is a real, demoable vertical slice. Work in a feature branch per job;
open a PR into `main`; at least one other teammate reviews before merging.

### Job 1 — Rooms, Chat & Realtime Backbone
- Owns: `server/index.js` (room join/leave, presence, chat relay, the
  `sync:event` relay other jobs broadcast through), `client/src/components/ChatPanel.jsx`,
  `client/src/components/RoomView.jsx`, `client/src/components/JoinScreen.jsx`.
- This is the foundation the other two jobs plug into — move first, and
  expect to pair with Jobs 2 and 3 at integration time.
- Branch: `feature/rooms-chat`

### Job 2 — Audio/Video/Screen Share
- Owns: `client/src/components/VideoPanel.jsx`. Integrate Daily.co
  (`@daily-co/daily-react` + `@daily-co/daily-js`) for a mic/camera tile grid
  and a screen-share control. Must be usable on a phone browser.
- This component is also the answer for "watch Netflix/Hulu/etc together" —
  one person screen-shares their tab.
- Branch: `feature/video-av`

### Job 3 — Synced Watch Party Playback
- Owns: `client/src/components/WatchPlayer.jsx`. Embed the YouTube IFrame
  Player API; emit/listen for `sync:event` (via the socket client in
  `client/src/lib/socket.js`) so play/pause/seek stay in sync across the room.
- First ~3 days: time-boxed research spike into true cross-service sync
  (Netflix/Hulu/other). Document findings in `LOG.md` regardless of outcome —
  if nothing viable turns up, that's a real, loggable result, not a failure.
- Branch: `feature/watch-sync`

### Integration (shared, not a 4th job)
Combining chat + video tiles + watch player into one working room page is
everyone's job. This happens after each person's slice works on its own
branch — see the timeline below.

## Timeline

- Oct 29–30: scaffold (done), this file, repo pushed.
- Oct 31–Nov 1: each person builds their slice on their branch; research
  spike runs in parallel.
- Nov 1: course milestone — portfolio card shows progress (doesn't need to
  be finished).
- Nov 2–5: integration via PRs, reviewed before merge.
- Nov 6–7: mobile testing, bug bash, fill in reflections.
- Nov 8: submit.

## Running locally

```bash
# backend
cd server
npm install
npm run dev        # http://localhost:3001

# frontend (separate terminal)
cd client
npm install
cp .env.example .env   # points at the local server by default
npm run dev             # http://localhost:5173
```

## Conventions

- Keep each job's changes inside the files it owns above; if you need to
  touch another job's files, say so in the PR description.
- Don't commit `.env` files or real API keys (Daily.co, etc.) — use
  `.env.example` to document what's needed and keep real values local /
  in the hosting provider's dashboard.
