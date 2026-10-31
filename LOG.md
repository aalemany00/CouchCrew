# CouchCrew — Plans & Changes Log

Shared log for TCSS 490 Artifact 4, per course requirement. Add an entry
whenever something real is decided, built, or abandoned. Newest entry on top.

---

## 2026-10-30 — Job 3: synced YouTube playback + cross-service research

**Who:** Job 3 owner, with Claude Code (branch `feature/watch-sync`).

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
