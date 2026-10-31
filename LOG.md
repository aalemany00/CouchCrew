# CouchCrew — Plans & Changes Log

Shared log for TCSS 490 Artifact 4, per course requirement. Add an entry
whenever something real is decided, built, or abandoned. Newest entry on top.

---

## 2026-10-30 — Merge resolution: Henry's Daily implementation wins

**Who:** Adrian, with Claude Code, resolving `feature/video-av` into `main`.

Henry's branch (below) independently built the same `/daily/room` endpoint
this log's previous entry describes, since his branch started before that
work was merged. His version (`server/daily.js`) is more robust — it
handles two people racing to create a room at once, sanitizes room names
more defensively, and sets useful Daily properties (screenshare enabled,
prejoin UI off) — so it replaces the inline version in `server/index.js`
rather than the other way around. No functional loss, same API contract
(`POST /daily/room { roomId } -> { url }`), both client implementations
already called it the same way.

**Verified before merging:** both `feature/video-av` and `feature/watch-sync`
build cleanly in isolated worktrees. `feature/watch-sync` was further
verified live — two browser tabs joined the same room, one loaded a real
YouTube video, and the second tab received the synced state and played the
same video within seconds (the join-time `request`/`state` handshake works
as designed). `feature/video-av`'s Daily integration was verified by code
review plus confirming the live `/daily/room` endpoint actually creates
real Daily rooms (see entry below) — not yet tested with two real browsers
in an actual video call.

---

## 2026-10-30 — Daily.co room endpoint for Job 2

**Who:** Adrian, with Claude Code, on `feature/daily-room-endpoint`.

**Context:** Henry's Claude session asked how a CouchCrew `roomId` should
map to a Daily.co video room, and laid out three options. We picked the
"correct end state" one (a server endpoint, one Daily room per CouchCrew
room) over the faster single-shared-room option, since it's not much more
work and avoids every room sharing one video call.

**What we built:** `POST /daily/room` on the server — takes `{ roomId }`,
creates or reuses a Daily room for it, returns the join URL. The Daily API
key stays server-side (`DAILY_API_KEY` env var, via `dotenv` locally /
Render's dashboard in production) so it's never exposed in client code.
Built this ourselves rather than having Henry edit `server/index.js`
directly, since two people editing the same file on separate branches is
exactly the collision the course's branch/PR process is meant to avoid.

**Verified:** missing `roomId` → 400, missing API key → clear 500 (not a
silent failure), and a test key correctly round-tripped to Daily's real API
and surfaced their auth error — confirms the full path works; just needs
Henry's real API key to actually create rooms.

**Open items:**
- Henry needs his own free Daily.co account/API key. The key is a server
  secret — give it to Adrian directly (not in the group chat) to set as
  `DAILY_API_KEY` on Render, rather than Henry having Render access himself.
---

## 2026-10-30 — Video/screen share first pass (Job 2)

**Who:** Henry, with Claude Code, on `feature/video-av`.

**What we decided:**
- Daily.co via `@daily-co/daily-react`, one Daily room per CouchCrew room.
  The server provisions it (`POST /daily/room`, new `server/daily.js`, key in
  `DAILY_API_KEY` on Render) so the API key never reaches the browser. Chose
  this over a single shared env-var room so rooms don't all share one call.
- Calls are opt-in: entering a room doesn't touch devices; "Join call" lets
  you pick mic/cam on or off. No camera/mic (or denied permission) still
  joins as a viewer; camera-off shows a name-initial tile.
- Responsive tile grid + control bar (mute, camera, share screen, leave);
  screen share spans the full grid width. Share button hidden on browsers
  that can't screen share (e.g. most phones).

**Touches outside Job 2's files (flag in PR):** `server/index.js` (2 lines to
register the route), `server/daily.js` (new), `render.yaml` (`DAILY_API_KEY`).

**Not yet verified:** end-to-end with a real Daily key and two browsers.

---

## 2026-10-30 — Room UX: shareable links, leave, persistence (Job 1)

**Who:** Adrian, with Claude Code, on `feature/rooms-chat`.

**What we built:**
- Real shareable room links (`/r/<code>`) instead of two people having to
  agree on and type the same code — "Create a new room" generates one and
  puts it straight in the URL.
- A "Copy invite link" and "Leave room" button in the room header.
- Session persistence: refreshing mid-room rejoins automatically instead of
  dropping back to the join screen; your name is remembered for next time.
- Also fixed: a dropped/restarted server now gets silently auto-rejoined
  via a `connect` listener that re-sends `room:join` (previously only ran
  once on mount, so a reconnect left you connected but not actually "in"
  the room until a manual refresh). UI shows "Reconnecting..." while down.
  Verified by killing and restarting the local backend mid-session.

**Why now:** this is all in Job 1's owned files, doesn't touch anything
Henry or John are building into (`VideoPanel.jsx`, `WatchPlayer.jsx`), and
directly serves the real use case — sharing a room with one other person
shouldn't require reading a code over text.

---

## 2026-10-30 — Deployed

**Who:** Adrian, with Claude Code.

**What we did:**
- Backend deployed to Render (free tier): https://couchcrew.onrender.com
- Frontend deployed to Vercel (free/Hobby tier): https://couch-crew.vercel.app
- Connected them: `VITE_SERVER_URL` on Vercel points at the Render URL,
  `CLIENT_ORIGIN` on Render points back at the Vercel URL for CORS.
- Verified live: joined a real room on the deployed site and confirmed
  presence/chat work against the deployed backend, not just localhost.

**Notes:**
- Render's free tier required adding a card for verification (a $1 temporary
  authorization, not a real charge) before it would deploy — expected
  behavior, not a billing issue.
- Free Render instances spin down after inactivity; first request after idle
  can take 30-60s to wake back up. Fine for this artifact, worth knowing so
  it isn't mistaken for a bug during testing/demo.

**Open items:**
- Henry and John can now build Jobs 2/3 against the live backend instead of
  only localhost.

## 2026-10-29 — Job assignment

**Who:** Adrian, with Claude Code.

**What we decided:**
- Adrian takes Job 1 (Rooms, Chat & Realtime Backbone) — continuity, since he
  built the initial scaffold and already knows that code.
- Team confirmed: **Henry** takes Job 2 (Audio/Video/Screen Share), **John**
  takes Job 3 (Synced Watch Party Playback). `CLAUDE.md` updated to match.
- `ONBOARDING.md` was sent to Henry and John to give their own Claude Code
  sessions full context on the course assignment and the project, without
  dictating how they build their piece.

**Open items:**
- Henry and John to clone the repo, check out `feature/video-av` and
  `feature/watch-sync` respectively, and start building.
- Daily.co account/API key not yet created — needed before Job 2 can start
  for real.
- No deployment yet (frontend/backend hosting) — scaffold currently only
  runs locally.

---

## 2026-10-29 — Scoping and scaffold

**Who:** Adrian, with Claude Code (planning session covered Artifact 4 only).

**What we decided:**
- Concept: a Discord-like watch-party room — chat, mic/cam, screen share,
  synced video playback, usable on phone. Real target user: Adrian and his
  long-distance partner, generalized to anyone who wants to watch something
  together remotely.
- Scoped true cross-service sync (Netflix/Hulu/etc.) as a time-boxed research
  spike, not a blocking requirement — DRM blocks the obvious approaches, and
  screen share already covers "watch anything together" as a fallback.
- Stack: React + Vite (client), Node + Express + Socket.IO (server) for
  rooms/chat/sync-event relay, Daily.co (managed WebRTC) for mic/cam/screen
  share, YouTube IFrame API for synced playback. Chose a managed WebRTC
  service over building raw WebRTC — the signaling/STUN/TURN setup has
  nothing to do with the actual product and is a classic time sink.
- Split work into 3 jobs so all three teammates get a major, demoable
  contribution: (1) Rooms/Chat/Realtime Backbone, (2) Audio/Video/Screen
  Share, (3) Synced Watch Playback + the Netflix/Hulu research spike.
  Integration (combining the three into one room page) is shared work, not
  a 4th job.
- Repo: new standalone GitHub repo `CouchCrew` under `aalemany00`, per the
  course's one-repo-per-artifact convention already used for Artifact 1–3.

**What we abandoned (for now):**
- "Watch Party for Two" as the literal scope — broadened to any-size room
  since Adrian wants Discord-like multi-person rooms, not just a pair.
- Building our own WebRTC signaling — not worth the time for a 2-week
  artifact where the room/sync/chat product is the actual point.

**Open items:**
- Teammates not yet assigned to Jobs 1/2/3 — team hasn't picked who does what.
- Daily.co account/API key not yet created — needed before Job 2 can start
  for real.
- No deployment yet (frontend/backend hosting) — scaffold currently only
  runs locally.
