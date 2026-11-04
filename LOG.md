# CouchCrew — Plans & Changes Log

Shared log for TCSS 490 Artifact 4, per course requirement. Add an entry
whenever something real is decided, built, or abandoned. Newest entry on top.

---

## 2026-11-04 — Room size cap (5) and a Help page

**Who:** Adrian, with Claude Code, on `feature/room-size-cap-and-help`.

**What happened:** after merging the TURN relay, the team discussed in
Discord whether to add usage tracking/a kill-switch to avoid ever getting
billed by Cloudflare. Henry ran the numbers: at 3 people per call, it'd
take about 370 hours (~15 days straight, no breaks) to burn through the
1,000 GB free allowance in a month; at 2 people, ~41 days straight, which
isn't possible in a 30-day month. His own point mattered more than the
cost one: camera quality stutters badly past 4-5 people in a call anyway,
regardless of cost. Decided against building usage tracking/a kill-switch
for that reason — a room size limit covers the problem that's actually
real, and the cost risk is negligible by comparison.

**What we built:**
- `server/index.js`: `MAX_ROOM_SIZE = 5`. `room:join` now rejects anyone
  past that with a `room:full` event instead of letting them in; existing
  members already in the room aren't affected by their own room filling up
  around them (checked by socket id, not just room size).
- `RoomView.jsx`: listens for `room:full` and shows a blocking "this room
  already has N people" screen with a button back to Home, instead of
  rendering the room UI at all.
- New `HelpPage.jsx` (`/help`, added to `NavBar`): explains the room limit
  (video quality first, cost a distant second, with the actual numbers),
  which streaming services work and why Netflix/Hulu/Prime/Disney+ don't,
  and what a "room is full" message means.

**Verified:** temporarily set `MAX_ROOM_SIZE = 1` locally, confirmed a
second browser tab joining the same room got the blocking "room is full"
screen (not just an error toast) and "Back to Home" correctly navigated
away; restored to 5 before committing. Help page renders and is reachable
from the nav bar.

**Note on the bandwidth numbers:** the 370-hours/41-days figures came from
Henry's own Claude session's calculation, not independently re-derived
here — cited as reported, not re-verified from scratch, since the room
size limit doesn't actually depend on the cost math being exactly right
(it's there for video quality either way).

---

## 2026-11-04 — Real in-app YouTube search (corrects an earlier decision)

**Who:** Adrian, with Claude Code. Touches John's file again (`WatchPlayer.jsx`).

**What happened:** Adrian wanted picking a video from the "Find on
YouTube" popup to automatically load it and close the popup, instead of
copy/pasting the link back manually. Looked into it: once that popup
navigates to youtube.com, our page can no longer read its URL at all —
same-origin policy, a hard browser security boundary, not something
fixable in our code. There's no way to "detect the click" from outside.

**This corrects the Oct 30 decision** ("Find on YouTube" popup instead of
a search API): that entry assumed the YouTube Data API needs a Google
Cloud billing account. Re-checked against Google's own getting-started
docs before building anything (same habit as the Daily.co/Jitsi
research) — enabling the YouTube Data API v3 and creating an API key does
**not** require billing, only an API key under Credentials. Confirmed by
testing: a placeholder key returned Google's own `"API key not valid.
Please pass a valid API key."` error, proving the request reaches Google's
real endpoint and will work with a real key, which needs to come from
Adrian's own Google account (not something this session can generate).

**What we built:** real in-app search behind an optional
`VITE_YOUTUBE_API_KEY` env var (see `.env.example`). With a key set, the
Load button becomes Search for anything that isn't already a video
link/ID, and results render as clickable thumbnails right in the room —
click one and it loads immediately via the exact same `loadYouTubeVideo`
path "Load" already used, no popup involved. Without a key configured
(e.g. Henry's or John's local setup, or until Adrian adds his own), the
button stays "Load", the old error message is unchanged, and the "Find on
YouTube" popup is still there — the feature degrades to exactly today's
behavior rather than breaking for anyone without a key.

**Verified:** tested both code paths — no-key fallback behaves identically
to before (same button label, same error text), and the key-present path
sends a real request to Google's API and surfaces its real error.
Quota: 100 units per search, 10,000/day default — about 100 searches/day,
fine for this group.

**Open items:**
- Adrian needs to create his own free API key (console.cloud.google.com →
  enable "YouTube Data API v3" → Credentials → Create API Key) and add it
  to `client/.env` locally, plus Vercel's environment variables for the
  deployed site, to actually turn this on.
- Once deployed, restrict the key to the YouTube Data API v3 and to the
  real domain(s) (an HTTP referrer restriction) so it isn't usable if
  leaked from the client bundle — it's client-side code, so the key is
  visible to anyone who looks, same as any client-side API key.

---

## 2026-11-04 — "Sign in to confirm you're not a bot" on YouTube embeds: not our bug

**Who:** Adrian, with Claude Code (no code change — a note for later).

**What happened:** loading a YouTube video in the room showed YouTube's
own "Sign in to confirm you're not a bot" interstitial inside the player.
Confirmed it's YouTube's anti-bot check, not a CouchCrew issue: our embed
config is a normal `playsinline`/`rel:0` setup, nothing restrictive. Likely
triggers are a VPN's IP reputation, browser privacy settings blocking the
iframe's cross-site cookie access to a YouTube session, or repeated
automated loads of the same video (which is also exactly what testing
this session's Twitch/Kick work did to one video). **Confirmed the actual
fix: turning off the VPN resolved it immediately.** Noting this so a
future "YouTube won't play" report isn't mistaken for a real bug before
checking VPN/network first.

---

## 2026-11-04 — Search for Twitch/Kick; ruled out Netflix/Hulu/Prime/Disney+/Tubi

**Who:** Adrian, with Claude Code. Touches John's file (`WatchPlayer.jsx`,
Job 3) again — same as the live-providers entry above.

**What we decided:** Adrian wanted to search Twitch/Kick the way the app
already searches YouTube, plus asked about adding Netflix, Hulu, Amazon
Prime, Disney+, and Tubi as watch-together sources.

**Search — built it.** Same pattern as the existing YouTube finder (added
earlier for the same reason: none of these sites can be embedded for
browsing): a "Find on Twitch/Kick ↗" button opens a popup to that
service's own search page, no API key or developer account needed.
Verified both open the correct domain with the typed query.

**Netflix/Hulu/Prime/Disney+/Tubi — not building this, and said so before
starting.** This isn't the same shape of problem as Daily.co vs. Jitsi
(where the fix was finding the actual free option). YouTube/Twitch/Kick
all ship a public embed player specifically so creators can share streams
elsewhere; Netflix/Hulu/Prime/Disney+ have no such product at all, by
design — their subscription model depends on content only playing inside
their own verified app, enforced by DRM, HTTP framing headers, and
licensing terms, not a missing free tier. Confirmed Tubi (free,
ad-supported) is the same story even though it carries no subscription —
same "no public embed program" conclusion John's Oct 30 research spike
already reached for Netflix/Hulu. The existing screen-share feature (Job 2)
stays the real answer for watching any of these together.

---

## 2026-11-04 — Free live-streaming providers: Twitch and Kick

**Who:** Adrian, with Claude Code, on `feature/live-streaming-providers`.
**Touches John's file (`WatchPlayer.jsx`, Job 3) — flagging for his review.**

**What we decided:** Adrian wanted the room to support watching a live
stream together, not just pre-recorded YouTube. Before building, verified
what's actually free (given Daily.co's and Jitsi's hidden catches earlier
in this project): Twitch's embed player (`player.twitch.tv`) needs no
account or API key, just a `parent` domain parameter; Kick's embed
(`player.kick.com/<username>`) needs nothing at all. Both confirmed
against their own docs, not third-party claims.

**What we built:** `WatchPlayer.jsx` now has a provider selector (YouTube /
Twitch (live) / Kick (live)). Live providers are architecturally simpler
than YouTube: since the content is already live, there's no play/pause/
seek state to keep in sync — "loading" just means everyone's iframe points
at the same channel, which rides on the existing `load`/`state`/`request`
sync:event shapes with a `provider`/`channel` field instead of `videoId`/
`time`/`playing`. The YouTube path (the actually delicate part — drift
correction, conflict resolution) is completely untouched: every YouTube
ref/handler still only runs when `provider === "youtube"`.

**A real bug avoided:** switching away from YouTube only hides its iframe
via CSS — the hidden `YT.Player` would otherwise keep playing audio in the
background. Added an explicit `pauseVideo()` call on provider switch.

**Verified for real, not just read the docs:** ran both the client and
server locally, joined a room as leader, loaded a real Twitch channel
(`shroud`) and a real Kick channel (`xqc`) — both rendered their actual
embed UI (including Twitch's own "channel is offline" state, proof it's
genuinely talking to Twitch's player, not a stub). Opened a second browser
tab as a non-leader joiner and confirmed it received the live channel via
the existing request/state handshake, locked (no controls). Then switched
back to YouTube and confirmed the original sync behavior still works
end-to-end, in both tabs.

**Bonus fix:** found a real bug while testing in the browser console (not
caused by this change) — `PixelTheaterScenery.jsx`'s decorative film-strip
rects could compute a negative `width` for the last two of eight
(`130 - i*22` goes to -2, -24), which React/SVG rejects. Clamped with
`Math.max(4, ...)`.

**Open items:**
- John should review the sync-shape change (`provider`/`channel` fields)
  since it's his file.
- Neither Twitch nor Kick require a "parent" or auth for the public player
  in local/dev testing; worth a quick re-check once deployed to Vercel
  that `window.location.hostname` resolves to the real domain for Twitch's
  `parent` param (it should, but not yet verified against the live site).

---

## 2026-11-04 — Grouped Watch Together + Video into one screen frame

**Who:** Adrian, with Claude Code, on `feature/screen-stack`.

**What happened:** Henry asked whether to keep patching Jitsi or move to a
native WebRTC rebuild; team decided on the rebuild (see 2026-11-01 entry).
While that's in progress on his end, did the other half of the mockups'
room-layout gap myself: the reference mockups show one big screen, but the
app had "Watch Together" and "Video & Screen Share" as two separate
bordered boxes stacked on top of each other.

**What changed:** wrapped `<WatchPlayer>` and `<VideoPanel>` in a new
`.screen-stack` div in `RoomView.jsx` — purely a layout wrapper, no change
to either component's own markup or props. Moved the themed border/
background from the individual panels onto the wrapper, flattened the two
children's own borders, and added a divider line between them so they read
as one screen with two sections instead of two separate boxes. Closed
Henry's stale PR #15 (a Jitsi-specific mobile sizing fix that no longer
applies once Jitsi is gone).

**Why this doesn't block Henry:** `VideoPanel` is still rendered with the
same `roomId` prop in the same spot; his WebRTC rebuild drops into
`.screen-stack` without needing to know this wrapper exists.

**Verified:** joined a real room locally, confirmed Watch Together and
Video & Screen Share render as one continuous frame with a clean divider,
Chat stays its own panel, and nothing in the chat/video/watch
functionality changed.

**Open items:**
- The mockups' bottom icon bar (camera/mic/chat/participants/leave) still
  needs Henry's new component to actually expose those controls before it
  can be built for real — not done here, since guessing at an API his
  rebuild hasn't written yet would likely need redoing.

---

## 2026-11-01 — Pixel-art theater scenes for all 8 themes (ChatGPT-built, reviewed and merged)

**Who:** Adrian directed ChatGPT to build this directly (not Claude Code);
Claude Code reviewed it, found and fixed one bug, and merged it.

**What happened:** Adrian's own quick CSS-gradient pass (`feature/theme-scenes`,
not merged) didn't look enough like his reference mockups. He had ChatGPT
build a replacement directly against the CouchCrew repo. Its first attempt
(`CinemaScenery.jsx`) was emoji scattered over CSS gradients — same
shortcut, plus a real bug (a multi-screen-height blank gap on Home from a
sizing mistake in its CSS). Its second attempt (`PixelTheaterScenery.jsx`)
was a genuine step up: a real parametrized SVG template giving each theme
distinct hand-coded architecture (Horror's broken roofline, Thriller's
rain-streaked blinds, Sci-Fi's ringed-planet porthole, Fantasy's stone
arch, etc.), applied consistently to Home, the Themes gallery, and the
room screen.

**Bug found during review, not by guessing:** inside a room, the "Watch
Together" / "Video & Screen Share" / "Chat" panel headings were nearly
invisible — near-black text on a dark panel. Traced it with computed
styles (not assumption) to a leftover Vite scaffold file, `index.css`,
still imported in `main.jsx` from before this project had its own design.
Its own `h1, h2 { color: var(--text-h) }` rule (`--text-h: #08060d` in
light color-scheme) was the only rule setting color on those headings, so
it won even though the app's own CSS loads after it — nobody had actually
looked closely at that text against a dark panel until now. This bug
already existed on `main`, unrelated to either theme attempt; it just
never got noticed before. Fixed by deleting the unused `index.css` import
and the file itself (confirmed nothing in the app referenced its classes).

**Verified:** all 8 themes' distinct art confirmed on Home, the Themes
gallery, and inside a real room; headings legible after the fix; theme
ids/icons unchanged from the existing set so server-side sync
(`VALID_THEMES`, `theme:set`) stays compatible.

**Note on process:** this is the first piece of CouchCrew built outside
Claude Code. Logged here per the same course requirement either way — the
log is about what changed and why, not which tool made the change.

---

## 2026-10-31 — Rebuilt the Home hero to match the mockup closely

**Who:** Adrian, with Claude Code, on `feature/theater-hero-rebuild`.

**What happened:** the previous pass ("Home/Rooms/Themes/Settings pages")
matched the mockup's *structure* but not its look — plain icon+label theme
cards instead of poster art, emoji instead of illustrated popcorn/reel, a
centered gold Pacifico logo instead of the mockup's tilted red/cream
script. Adrian asked for a much closer match, scoped to just the Classic
hero (the only screen he actually gave a reference image for — the other
7 themes' visuals are intentionally left alone).

**What we built, all hand-coded SVG/CSS since there's no image-generation
tool in this environment:**
- New `TheaterArt.jsx`: `ScreenBackdrop` (night-sky gradient, fanned
  searchlight beams, a city skyline, two palm trees — each a curved trunk
  with six fan-shaped fronds reused via `<use>`), `PopcornAndReel` (a
  striped bucket with overflowing kernels, a film reel with an unspooling
  perforated strip), `SeatsRow` (a faint repeated seat-silhouette strip).
- Logo: swapped Pacifico for Lobster, red/cream coloring with a drop-shadow
  outline, a slight tilt, and a curved underline swoosh beneath it —
  matches the mockup's script style much more closely than the old flat
  gold version.
- Curtains: scalloped bottom edge (CSS `clip-path`) with a gold fringe
  trim line, now spanning the full hero height (including behind the new
  chat panel) instead of just the screen.
- Added the mockup's docked chat preview panel beside the hero screen —
  explicitly a preview, not live chat (nobody's in a room yet on this
  page), matching the mockup's own "Start chatting with your crew!" empty
  state so it isn't a misleading fake feature.
- Nav bar: added mic/camera icons (decorative — they only mean something
  inside a real room's call) and a profile icon that's a real shortcut to
  Settings, plus the glowing red divider line beneath the nav.
- "Choose a theme" heading now has the mockup's flanking divider lines.

**Verified:** full visual comparison against the mockup side by side —
palm trees needed a redo (first attempt looked like loose leaves, not a
tree; rebuilt with a proper fan-of-fronds shape); confirmed "Create a
Room" still works and lands in a real room; full mobile-viewport pass
(chat panel wraps below the screen, curtains/popcorn scale down, nothing
overflows).

---

## 2026-10-31 — Home/Rooms/Themes/Settings pages, 3 more genres

**Who:** Adrian, with Claude Code, on `feature/home-and-themes`.

**What happened:** Adrian had ChatGPT generate visual inspiration for the
drive-in theater direction (a mockup with a full app shell: nav bar, a
marquee hero screen with curtains/popcorn/film-reel decor, ticket-style
buttons, poster-card theme selectors, and 3 extra genres beyond our
existing 5). Decided to build it close to that mockup rather than just
reskin the single room screen.

**What we built:**
- Real path-based navigation (no router library — `lib/router.js`) across
  four new pages: Home (hero + theme picker), Rooms (join by code + recent
  rooms from localStorage), Themes (full gallery, pick-and-go into a new
  room), Settings (display name). `NavBar` shows on all of them; the room
  itself keeps using its own themed header instead, so the nav doesn't
  compete with it.
- Added 3 new genre themes — Sci-Fi, Fantasy, Action — bringing the total
  to 8, each with its own CSS palette and chat-trigger easter egg
  ("engage warp" / "by the ancients" / "duck and cover").
- Drive-in visual details from the mockup, built in CSS/SVG since no
  image-generation tool is available here: velvet curtain panels flanking
  the hero screen, a popcorn/film-reel decorative corner, a marquee-light
  dot border around the hero screen, a Pacifico script logo, a dashed
  ticket-style "Create a Room" button. Not a pixel copy of the AI-generated
  mockup art, but the same structural idea built from code.
- Picking a theme on Home or Themes before creating a room now actually
  applies it: `RoomView` takes an `initialTheme` prop and the room's
  creator (its first joiner/leader) sets it once via the existing
  `theme:set` event — no new server logic needed beyond what leadership
  already provides.
- Simplified `JoinScreen.jsx`: under real routing, it's only ever reached
  via `/r/<roomId>`, so its old manual-code-entry branch was dead code and
  got removed instead of left to rot.

**Verified:** full click-through of Home → Rooms → Themes → Settings and
back; all 8 theme poster cards render in their own color identity (an
emergent bonus — `data-theme` on each card scopes the CSS variables to
just that card); selecting Sci-Fi from the Themes gallery created a room
that opened already in the Sci-Fi palette, and its "engage warp" trigger
phrase worked correctly; a direct `/r/<roomId>` link (the original
share-a-link flow) still works unchanged; recent-rooms list correctly
picks up a joined room; full mobile-viewport pass on the new pages.

---

## 2026-10-31 — Retro drive-in theater look, genre themes, four easter eggs

**Who:** Adrian, with Claude Code, on `feature/theater-theme`.

**What we decided:** Adrian wanted the site to actually feel like a venue —
a retro drive-in/80s theater — with genre-based mood themes (leader picks
one, like dimming the lights for a horror movie) and some hidden
interactive touches, not just a functional UI.

**What we built:**
- Visual shell: Bungee/Oswald fonts, a subtle starfield background, a neon
  marquee room title, a glowing marquee-light border around the watch
  screen. CSS/markup only in `RoomView.jsx`/`App.css` — no class names Jobs
  2/3 render into were touched, so their components needed zero changes.
- Leader-controlled genre theme (Classic/Horror/Romance/Thriller/Comedy):
  `data-theme` attribute swaps CSS custom properties for the accent color
  and panel tones. Synced via a new `theme:set` server event, guarded the
  same way `leader:transfer` is.
- Four easter eggs: a secret snack-click animation (3 fast clicks), a
  marquee-title click-mash that reveals a hidden credits line (5 fast
  clicks), genre-matched chat trigger words that set off a visual flourish
  for the whole room (rides along on the already-broadcast chat message —
  no new server event needed), and a hold-to-leave button (holding 3s shows
  a theatrical pause before actually leaving; a plain click does nothing).

**A real bug we hit and fixed:** the socket-listener `useEffect` in
`RoomView.jsx` originally had `theme` in its dependency array, so changing
the theme tore down and reconnected the socket every time — which, in a
room with only one person testing, briefly emptied the room and wiped its
server-side state (including the theme itself, snapping it back to
"classic" instantly). Fixed by moving the theme read inside the chat-egg
handler to a ref (`themeRef`) instead of a dependency, so the effect no
longer needs `theme` in its array. Root-caused by watching the actual
`room:presence` payload in the console (it was already correct — `theme:
"horror"` — before the reconnect silently undid it), not by guessing.

**Verified:** all five themes switch correctly and instantly; all four
easter eggs triggered and behaved as designed in a real browser; confirmed
Henry's Jitsi call and John's synced YouTube playback both still work
correctly inside the new shell (loaded a real video, joined a real Jitsi
room); full mobile-viewport (375px) pass — theme chips wrap, snack bar
fits, nothing overflows.

---

## 2026-10-30 — Room leader: one person controls what's playing

**Who:** Adrian, with Claude Code, on `feature/room-leader`.

**What we decided:** rather than anyone in the room being able to load a
video or hit play/pause (which can fight for control with multiple people),
the room now has one leader — whoever created it — who alone controls video
selection and playback. The leader can hand control to someone else; if
they disconnect, it passes to another member automatically so the room is
never stuck with no one able to do anything.

**What we built:**
- `server/index.js`: a `roomId -> leaderId` map. First joiner into an empty
  room becomes its leader. New `leader:transfer` event, accepted only from
  the current leader, targeting someone actually in the room. Leadership
  reassigns automatically on the leader's disconnect.
- `RoomView.jsx`: shows 👑 next to the leader's name, a "Make leader" button
  next to everyone else (visible only to the leader), passes `isLeader` down
  to `WatchPlayer`.
- `WatchPlayer.jsx` (Job 3's file — flagging for John's review): non-leaders
  get a locked iframe (`pointer-events: none`) and the load form replaced
  with a status message; only the leader's play/pause/seek/load actions
  broadcast to the room.

**Verified with two real browser tabs:** room creator showed as leader with
the load controls; second tab correctly saw itself as a non-leader with
locked controls and the right message. Clicking "Make leader" on the first
tab correctly flipped both tabs' UI in real time — the old leader lost
controls, the new one gained them, bidirectionally and instantly.

**Known limitation:** leadership is tied to a socket id, so a leader who
disconnects and reconnects doesn't automatically get leadership back (they
get a new socket id) — someone else becomes leader instead. Acceptable for
this artifact's scope.

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

## 2026-11-04 — First cross-network test fails: add a TURN relay (Job 2)

**Who:** Henry, with Claude Code, on `feature/turn-relay`.

**What happened:** after the peer-to-peer call merged, Henry tested solo with a
laptop on one network and a phone on another. Each device saw its own camera
but not the other; the tile said "can't connect". That is the risk logged
above: with only public STUN servers, two devices on different networks
(home Wi-Fi vs cellular) usually can't reach each other directly.

**Fix:** a TURN relay. New `GET /ice` on the server (`server/ice.js`) mints
short-lived Cloudflare Realtime TURN credentials and returns them with STUN;
`VideoPanel.jsx` fetches them when you press Join call (falls back to STUN if
the server is unreachable). The key lives only in Render env vars
(`CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`). Without them the
endpoint still works and returns STUN only, so nothing breaks locally.

**Not yet verified:** needs a Cloudflare TURN key created and added on Render,
then a repeat of the laptop + phone test. Cloudflare bills TURN traffic after
a free allowance; we haven't confirmed the allowance size.

**Update (Adrian, with Claude Code):** checked Cloudflare's own pricing
page before merging — the free allowance is 1,000 GB/month (shared between
TURN and their SFU product), $0.05/GB after that, no credit card required
to start. A couple of people's calls won't come close to that, so this
isn't the Daily.co situation again. Also tested the actual merge locally
against current main before merging (this branch was cut before the
Twitch/Kick/search work landed, so a stale-looking diff needed an actual
merge test, not just a read, to confirm nothing would be lost — it merged
clean), and read through `ice.js` and the `VideoPanel.jsx` diff: the
Cloudflare secret stays server-side, only short-lived generated
credentials reach the browser, and there's a 5s timeout so a slow/down
server doesn't hang the Join call button. Merged as PR #25. Adrian has
added the two Render env vars; waiting on Henry to repeat the laptop +
phone test against the live site to confirm `relay:true` actually fixes
the cross-network case.

**Also reported, not ours:** the shared YouTube video is slightly out of sync
between the two devices. That is the watch-sync player (Job 3, John).

---

## 2026-11-04 — Replaced Jitsi with our own peer-to-peer call (Job 2)

**Who:** Henry, with Claude Code, on `feature/video-av`. Decided by Adrian.

**Why:** the Jitsi embed on `meet.jit.si` kept dropping us: calls ended early,
we couldn't rejoin, and anonymous rooms weren't real rooms. Meet.jit.si has
required a signed-in moderator since Aug 2023, so a sign-in would only fix it
for whoever created the room. Daily (earlier) needed a card. So: no third party.

**What we built:** a WebRTC call where each person connects directly to each
other person (mesh — fine for a handful of people). Mic, camera and screen
share all work; leaving and rejoining works; people with no camera/mic can
join as viewers.
- `server/index.js`: new `call:join` / `call:leave` / `rtc:signal` events. The
  server only relays setup messages between people in the same call; no media
  passes through it. (Outside Job 2's files — flagged for review.)
- `VideoPanel.jsx`: rewritten. Uses "perfect negotiation" so two people
  changing something at once (e.g. both start sharing) don't deadlock. Camera
  off really stops the camera. Each tile shows "connecting…" or "can't
  connect" so a failure is visible, not silent.

**Tested:** two browser tabs against a local server, with a fake camera/mic
(the testing browser blocks real ones): connect, audio + video flowing, rejoin,
both sharing a screen at once, camera off/on, mute indicator, stop sharing. This
caught a bug where renegotiation hung (the person who joined re-attached their
media on the first incoming offer and threw); fixed.

**Not yet verified / known risk:**
- A call between real devices, and on a phone. Phone browsers generally can't
  screen share.
- Only free public STUN servers are configured. Some networks (campus, phone
  carriers) block direct connections and need a TURN relay; those people will
  see "can't connect". A relay can be added with `VITE_ICE_SERVERS` (JSON) once
  we pick a free one. Mesh also gets heavy past ~4-5 people.

---

## 2026-11-01 — Job 2 follow-up after the Jitsi switch (Job 2)

**Who:** Henry, with Claude Code, on `feature/video-av`.

**What happened:** my Daily.co version (custom tile grid, `/daily/room`
endpoint) merged, then was replaced by Adrian's Jitsi embed after Daily's
free tier turned out to need a card on file. Re-synced `feature/video-av`
with `main`; nothing of the Daily code remains, which is the intended state.

**What changed:** on phones (<=640px) the Jitsi frame is now ~70vh tall
instead of 16:9, which is only ~210px on a 375px-wide screen.

**Live-site check (Henry, browser pane):** created a room on
couch-crew.vercel.app, pressed Join call; the Jitsi iframe loaded from
meet.jit.si with camera/microphone/display-capture permissions granted. The
frame was only ~290x165px in the desktop video column, so added
`min-height: 420px`. The testing browser blocks camera access, so no actual
call was possible there.

**Real test (all three of us, own devices):** the Jitsi call works, with
Adrian, Henry and John each in a tile. The shared YouTube player did not:
YouTube showed "Sign in to confirm you're not a bot", so nothing played.
Open question for Job 3 / integration: whether that's YouTube distrusting
the embed (and whether anything we control fixes it) — not yet investigated.

**Follow-up:** sometimes video/voice isn't shared between us. Cause unknown
(different Jitsi rooms, muted/blocked devices, NAT/firewall, or public-server
limits are the candidates). Added a diagnostic under the call frame: live
participant count, the Jitsi room name, and a log of join/leave/mute/error
events, to be read on the next test.

**Still not verified:** screen share, and mic /
camera on an actual phone browser. Note: mobile browsers generally can't
screen share at all, so on phones the Jitsi share option may be absent.

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
