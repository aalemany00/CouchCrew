# CouchCrew — Plans & Changes Log

Shared log for TCSS 490 Artifact 4, per course requirement. Add an entry
whenever something real is decided, built, or abandoned. Newest entry on top.

---

## 2026-10-30 — "Find on YouTube" popup instead of a search API

**Who:** Adrian, with Claude Code, on `feature/youtube-finder`.

**What we decided:** we wanted to browse/search YouTube without leaving the
room, but confirmed two real constraints first: YouTube's own site blocks
being embedded for browsing (only single-video players are embeddable), and
an in-app search box would need the YouTube Data API, which requires a
Google Cloud billing account (card) just to enable the API at all — same
situation as Daily.co. We did confirm the API's free quota is a hard cap
(requests fail past it, not billed further), but decided against adding yet
another third-party billing account for this project.

**What we built instead:** a "Find on YouTube ↗" button next to the link
input in `WatchPlayer.jsx`. It opens a small popup window to YouTube —
pre-filled with a search if you typed one, or the homepage if you didn't —
so you search right there, copy the link, and paste it back in without a
full tab-switch. No account, no API key, no card, works today.

**Verified:** triggers the popup correctly with the right search URL (the
automated test browser's popup blocker stopped it, as expected for a
non-human click — real clicks aren't affected).

---

## 2026-10-30 — Switched Job 2 from Daily.co to Jitsi Meet

**Who:** Adrian, with Claude Code, on `feature/jitsi-switch`.

**What happened:** testing Henry's merged Daily.co integration live hit
`Meeting ended in error: account-missing-payment-method`. Turned out Daily's
free allowance (10,000 participant-minutes/month) is bundled into their one
paid plan, not a separate free tier — a credit card is required on the
account to use it at all, even though signup itself asks for no card. We'd
rather not have anyone on the team deal with a billing account for a class
project, so we switched providers instead of adding a card.

**What we built:** `VideoPanel.jsx` now embeds **Jitsi Meet's free public
server** (`meet.jit.si`) via its IFrame API. Verified (per Daily's own
pricing page, fetched directly) that this needs no account, API key, or
payment method — genuinely free, not "free tier of a paid plan." Removed
`server/daily.js`, the `/daily/room` endpoint, the `@daily-co/*` client
packages, and `DAILY_API_KEY` from Render/`render.yaml`/docs.

**Trade-off:** Henry's Daily version had a custom per-participant tile grid
built with React hooks (mute/camera-off indicators, camera-error handling).
Jitsi's IFrame API embeds Jitsi's own complete call UI instead — still has
mic/camera/screen-share, just not the same level of custom UI control. That
work isn't wasted as a learning exercise, but it's not what's live.

**Open items:**
- Verify end-to-end with a real call (two people, real mic/camera) once
  this is deployed.
- Tell Henry about the switch and why.

---

## 2026-10-30 — Chat history + join/leave messages (Job 1)

**Who:** Adrian, with Claude Code, on `feature/rooms-chat`.

**What we built:**
- Server keeps the last 50 messages per room so joining mid-conversation no
  longer drops you into an empty chat panel — history is sent as part of
  `room:joined` and cleared when the room empties (same lifetime as the room).
- "X joined the room" / "X left the room" system messages, broadcast and
  stored in the same history, rendered visually distinct from real chat.
- Chat auto-scrolls to the latest message; messages are capped at 500 chars
  client- and server-side.

**Verified:** two real browser tabs — a second tab joining via a shared
link immediately saw the first tab's message and its own join confirmed to
the first tab live; closing the second tab showed "left the room" on the
first tab and presence dropping correctly.

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

## 2026-10-30 — Job 3: synced YouTube playback + cross-service research

**Who:** John Nguyen (Job 3), with Claude Code (branch `feature/watch-sync`).

**What we built:** `WatchPlayer.jsx` embeds the YouTube IFrame Player API.
Anyone in the room can paste a YouTube link and control playback; play,
pause, seek and load go out over the existing `sync:event` relay, so
`server/index.js` is unchanged.

**What we decided:**
- Anyone-controls (no host), because the room is small and trust is high.
- Late joiners ask the room for state (`request` / `state` events) instead
  of the server remembering it, so Job 1's file stays untouched. Cost: if
  nobody in the room has a video loaded, a new joiner sees nothing until
  someone loads one.
- YouTube has no seek event, so seeks are detected by polling twice a
  second and treating a jump over 1.5s as a seek.
- Drift correction: whoever acted last sends a heartbeat every 5s while
  playing; anyone more than 2s off jumps to match.
- Simultaneous actions: events carry the sender's socket id and a conflict
  within 0.6s is won by the lower id on both sides, so everyone converges.

**Tested in a real browser (two tabs):** late join mid-video, pause, seek,
and play from the other side all synced. Not tested: the simultaneous-action
tie-break (needs two real users acting at once) and a real phone.

**Bugs found and fixed while testing:**
- The hidden player frame was sized to the whole window and made the page
  wider than the screen. It is now anchored to its panel (`App.css`).
- A hot reload recreated the player empty, so that tab could no longer
  answer a new joiner. The player now restores its last known state.

**Research spike: syncing Netflix / Hulu / other DRM services**
Outcome: no workable approach inside our scope. Findings:
- DRM'd video can't be embedded or scripted from our page the way YouTube
  can, so we can't drive someone else's Netflix player from the site.
- The only thing that works in practice is what the Teleparty extension
  does: every viewer installs a browser extension, logs into their own
  subscription, and the extension syncs play/pause/seek between those
  separate players. It does not carry the video itself.
- That fails our requirements: it needs every viewer to install an
  extension (desktop browsers; not a phone browser) and every viewer to
  hold their own subscription. "Everyone watches their own thing" is
  already out of scope in `CLAUDE.md`.
- Caveat on sources: a web search found consumer how-to pages and store
  listings, not technical documentation. The DRM reasoning above is from
  general knowledge and was not verified against the Teleparty source or
  the EME spec.
- Decision: we are not pursuing it. Screen share (Job 2) stays the answer
  for "watch anything together"; note that it may show a black picture for
  DRM'd content in some browsers, which we have not tested.

**Open items:**
- Real-phone test of the watch player.
- Integration with Job 2's video panel on one page, and a check that the
  watch player and Daily.co don't fight over audio.

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
