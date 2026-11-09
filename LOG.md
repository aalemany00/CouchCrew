# CouchCrew — Plans & Changes Log

Shared log for TCSS 490 Artifact 4, per course requirement. Add an entry
whenever something real is decided, built, or abandoned. Newest entry on top.

---

## 2026-11-05 — First-visit room tips and leader-set room name (Henry, touches Job 1's files)

**Who:** Henry, with Claude Code, on `feature/room-hint-rename`. These are
Adrian's files (rooms/onboarding), so the PR flags them for his review.

**What we built:**
- **"What do I do first" tips:** a dismissible panel at the top of a room with
  three steps (copy the invite link, press Join call, leader picks a video),
  worded differently for the leader and everyone else. "Got it" remembers the
  dismissal in this browser; a new **?** button in the room header brings it
  back. New `RoomTips.jsx` + `lib/tips.js`, small hooks in `RoomView.jsx`.
- **Invite section in ☰ Room Settings:** shows the room code and a copy-link
  button, so the link can be re-copied from the settings menu as well as the
  header button (which already existed).
- **Room name:** the leader can give the room a display name from ☰ Room
  Settings. It shows as the page title with "Room code: ..." underneath. The
  link/code never changes, so existing invites keep working. New `room:rename`
  server event (leader only, trimmed, 40 characters, empty clears it), sent to
  everyone with the other room state, and cleared when the room empties.

**Decision:** "rename" means a display name, not changing the code. Changing
the code would break every link already shared and would need the server to
move a live room, which isn't worth the risk days before the deadline.

**Tested:** two browser tabs against a local server. Tips show the right text
for leader vs non-leader, dismiss and reopen work. A leader rename reaches the
other tab; the non-leader's settings have no rename box. Direct socket test:
a non-leader's rename is ignored, an 80-character name is cut to 40, and a
blank name clears it.

**Not yet checked:** the tips panel and the new settings section on a phone
screen, and across a server restart (names live in memory like the theme, so
they reset when the room empties or the server restarts).
## 2026-11-06 — Admin: list/delete accounts (Settings)

**Who:** Adrian, with Claude Code, on `feature/admin-account-management`.

**What happened:** after the Turso migration, Adrian asked to get his
developer badge back and to remove the other (test) accounts that had
piled up. Checked first: his production account still existed with its
security question intact (the Render-file bug hadn't actually wiped it
yet at that point), and the developer badge is computed live from the
signed-in account's email on every room:join - there's no extra per-
account state to "re-apply," so nothing was actually lost there. But there
was no way to remove *other* accounts at all: `DELETE /api/auth/account`
intentionally requires the target account's own password (you can only
delete yourself), so cleaning up test/teammate accounts had no path that
didn't involve touching the database directly.

**What we built:** a small admin capability gated to the one hardcoded
developer account (`server/developer.js`, now shared between the room
badge check and this, so they can't drift apart):
- `GET /api/admin/users` / `DELETE /api/admin/users/:id`, both behind a
  `requireDeveloper` check - a non-developer account gets a 403, verified
  directly (not assumed).
- A collapsible "Admin: accounts" section in Settings, visible only when
  `user.isDeveloper` is true (computed server-side, never trusted from the
  client) - lists every account, lets you delete one at a time, or
  everything except your own with a single confirm.
- The admin delete route refuses to delete the caller's own account (use
  the regular password-confirmed delete-account flow for that) - it's a
  one-line mistake-guard, not a security boundary, since the account would
  obviously have the authority to delete itself anyway.

**Verified for real:** created a developer account plus two "other" test
accounts locally, confirmed the admin panel correctly lists all three with
"(you)" on the right one, deleted one individually (button, no `window.
confirm`), confirmed server-side the deleted account can no longer log in,
and confirmed access control both ways - the developer's own token can
list accounts, a non-developer's token gets a 403. (The bulk "delete all
others" button uses `window.confirm`, which the browser-automation
environment used for testing silently dismisses - not re-verified through
that exact path, but it calls the same per-account delete already proven
to work.)

**Open items:**
- Once Turso is wired up in production (previous entry), this is the tool
  to use for cleaning up whatever test accounts exist there - sign in as
  the developer account on the live site and use the panel directly,
  rather than this session touching production data.

---

## 2026-11-06 — Accounts were being silently wiped on every deploy (fixed)

**Who:** Adrian, with Claude Code, on `feature/persistent-accounts-turso`.

**What happened:** Adrian signed up for an account, then later found
"Forgot Password" reported "No account with that email" for the exact
email he signed up with. Traced it to `server/db.js`: accounts were stored
in a SQLite file on the server's own disk (`node:sqlite`), and that file's
own comment already said this resets on Render's free tier - but that was
logged as an "accepted tradeoff" rather than something that would actually
bite. It bites constantly: Render redeploys on every merge, and each
redeploy wipes the file, deleting every account that existed since the
last deploy. With how often this team merges PRs, real accounts were never
going to survive more than a day or two.

**Checked before proposing a fix (not assumed):** confirmed against
Render's own docs that free web services have an ephemeral filesystem
wiped on every redeploy/restart/spin-down, and that Render's own free
alternatives aren't durable either - free Postgres expires 30 days after
creation, and free Key-Value doesn't persist restarts. So this needed an
external service, not a Render setting. Turso (hosted SQLite/libSQL)
confirmed free with no card: 5GB storage, ~500M reads/10M writes a month,
comfortably past anything this project needs.

**What we built:** `server/db.js` now uses `@libsql/client` instead of
`node:sqlite` - same SQL, but every call is async (libSQL's client is
Promise-based). `server/auth.js` and the one other caller
(`server/index.js`'s developer-badge check) now `await` those calls.
With `TURSO_DATABASE_URL` unset, it falls back to a local file (libSQL's
own embedded mode) - so running the server locally still needs no account
or setup at all, same pattern as the Cloudflare TURN relay (real
credentials only required in production).

**Verified for real:** started the server locally against the existing
`node:sqlite`-created file - libSQL opened it with no migration needed and
found Adrian's real account already in it (confirmed via a direct
`/api/auth/security-question` call). Then ran the actual failure mode:
signed up a fresh test account, fully restarted the server process
(simulating a redeploy), and logged back in - succeeded. Also signed up
through the real UI (not just curl), confirmed the full account flow
(profile fields, sign out, delete account) still works end to end, then
deleted the test account.

**Open items:**
- Adrian needs to create a free Turso database and add
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` to Render's environment
  variables for this to actually take effect in production - without
  them, production keeps using Render's own ephemeral file and the bug
  isn't actually fixed yet, just made fixable.
- Whichever real account Adrian had before this (the one "Forgot
  Password" couldn't find) is gone for good - wiped by whatever redeploy
  happened after he signed up. He'll need to sign up again once Turso is
  wired in.

---

## 2026-11-06 — Replaced the dev badge chip with a permanent glowing name/avatar

**Who:** Adrian, with Claude Code, on `feature/dev-identity-glow`. Follow-up
to the "developer badge" entry below, per Adrian's own feedback: he didn't
want a separate tag that needed a click/room-settings visit to notice -
just wanted his own identity to look different everywhere his name shows,
automatically.

**What changed:** removed the "🛠️ Dev" chip from the People list, Leader
list, chat, and profile card. In its place, `.dev-name`/`.dev-avatar` in
`App.css` give the verified account's name text a permanent cyan/magenta
neon glow (`text-shadow`, fixed hex colors rather than the room's theme
variables, so it looks the same in every one of the 8 themes) and its
avatar circle a matching glowing ring - applied via a plain CSS class
added wherever `isDeveloper` is true, no extra markup or click needed to
reveal it. The server-side verification from the previous entry (checking
the real signed-in account's email, not anything the client claims) is
completely unchanged - this was a display-only follow-up.

One implementation note worth keeping: `.dev-name`/`.dev-avatar` had to be
moved to the very end of `App.css`, since `.member-name-button` and
`.chat-sender-name` both set `color: inherit` and are declared later in
the file than where these rules first lived - same CSS specificity means
whichever rule comes last in the file wins, so the glow was silently
getting overridden back to the default color until they were moved.

**Verified:** sent a chat message and opened the room settings drawer as
the verified account - "Adrian" renders in a visible cyan glow against
plain white chat text in both places, with a matching glow ring on the
avatar, with no click or hover required to see it.

---

## 2026-11-06 — A verified "developer" badge

**Who:** Adrian, with Claude Code, on `feature/developer-badge`.

**What we built:** a 🛠️ "Dev" badge next to Adrian's name wherever a name
shows up in a room - the People list, the member profile card ("🛠️ Built
this app"), and chat messages. Deliberately **not** something the client
can claim for itself: `room:join` now optionally carries the signed-in
session's `authToken`, and `server/index.js` looks that token up via
`getUserByToken` (from `server/db.js`) and checks the account's *actual*
email server-side against one hardcoded address
(`adrian.alemany2@gmail.com`) before ever setting `isDeveloper` on that
member's record - typing a name, or any client-side trick, can't produce
the badge. Chat messages snapshot `isDeveloper` the same way they already
do for avatar/bio.

**Verified:** signed in locally as that account, created a room, and
confirmed the badge shows in the People list and the profile card
("🛠️ Built this app"); joined the same room from a second tab signed out
(just "Henry", no account) and confirmed no badge appears for them -
having a name or being in the room isn't enough, only the verified
account is.

---

## 2026-11-06 — Delete account

**Who:** Adrian, with Claude Code, on `feature/delete-account`.

**What we built:** `DELETE /api/auth/account` (`server/auth.js` +
`deleteUser` in `server/db.js`) - requires the current password, same as
changing it, rather than being a single click; removes the user row and
every session for that account. Settings' Account section has a "Delete
account" action that opens a clear warning plus a password-confirmation
form before anything happens. Deleting signs you out but deliberately
doesn't touch `couchcrew:name`/`avatar`/`bio` in `localStorage` - your
name/photo/bio keep working as a local, no-longer-account-backed profile
afterward, same as before ever signing up.

**Verified:** wrong password on the confirmation form is rejected with
"Password is wrong." and nothing is deleted; the correct password deletes
the account, signs the UI back out to the Sign In/Sign Up/Forgot Password
view, and confirmed via `/api/auth/login` that the deleted account can no
longer sign in at all.

---

## 2026-11-06 — Real user accounts: sign up/in, change/reset password, account-backed profile

**Who:** Adrian, with Claude Code, on `feature/user-accounts`. Discussed
scope with Adrian first (two real decisions, not ones to make silently):
no email service is set up for this project, so "forgot password" uses a
security question instead of an emailed reset link; account data lives in
a single SQLite file on the server (`node:sqlite`, built into Node - no
new dependency, no native module to build/deploy), which resets on a
redeploy to an ephemeral host like Render's free tier - an accepted
tradeoff for a course project, not something production-grade.

**What we built:**
- `server/db.js`: users + sessions tables. Passwords and security-question
  answers are hashed with `scryptSync` (built into `node:crypto`, no
  bcrypt dependency) with a per-secret random salt, compared with
  `timingSafeEqual`. Never stored or returned in plain text.
- `server/auth.js`: `POST /api/auth/signup`, `/login`, `/logout`,
  `GET /me`, `POST /security-question` + `/reset-password` (the two-step
  forgot-password flow), `POST /change-password` (requires the current
  password), `PUT /profile` (name/avatar/bio only - this route physically
  cannot touch email or password).
- `client/lib/auth.js` + new `AccountSection.jsx` (shown in Settings,
  above the profile form): sign in / sign up / forgot password when
  signed out; email (never shown to anyone else) + change-password when
  signed in.
- **"Profile translates over to rooms, except email/password"**: signing
  in copies the account's name/avatar/bio into the exact same
  `localStorage` keys (`couchcrew:name`/`avatar`/`bio`) that
  `ProfileForm`/`RoomView`/`ChatPanel` already read and sync to rooms -
  none of that existing code needed to change or even know accounts
  exist. Saving the profile form while signed in also pushes the update
  back to the account (`PUT /api/auth/profile`), so it's there next time
  you sign in anywhere. Email and password are only ever handled by
  `auth.js`'s own routes - they're never part of `room:join`/
  `profile:update`'s payload, so there's no path for either to reach a
  room or another viewer.

**Verified end to end:** signed up a new account, confirmed the profile
form was pre-filled with the account's name immediately after; signed
out, used "Forgot Password" with the security question, got the
right question back, answered it (case-insensitively - typed "jaws" for
an answer saved as "Jaws") and reset the password, which signed back in
automatically; changed the bio while signed in and confirmed via
`/api/auth/me` that it persisted server-side; created a room and opened
the member profile card - the account's bio showed up there correctly.

**Known limitations, accepted for scope:** no email verification or
real password-reset email (the security-question tradeoff above); no
rate-limiting on login/signup attempts; the security-question reset
necessarily confirms whether an email has an account (a real emailed
link wouldn't do that) - normal for this kind of lightweight reset flow,
just worth knowing; editing profile from the in-room settings drawer
updates the room and `localStorage` but doesn't push back to the account
record (only the standalone Settings page's save does) - a real gap if
someone edits their bio mid-room and expects it saved to their account.

---

## 2026-11-06 — Archive.org search: cut the clutter, surface popular results

**Who:** Adrian, with Claude Code, on `feature/archive-search-quality`.

**Why:** searching "jaws" returned a Twitter bot clip, a fire-department
rescue video, random YouTube reaction videos, and a Funny or Die sketch
before anything resembling the actual movie - archive.org's generic
"movies" mediatype includes literally anything anyone's ever uploaded
labeled as video. Adrian wants strictly real movies/TV, not news, and only
well-known results, not obscure clutter.

**What changed** (`server/archive.js`): the search query now scopes to
the real movie/TV collections (`feature_films`, `classic_tv`,
`television`) instead of the open "movies" mediatype alone, explicitly
excludes the News & Public Affairs collection, requires at least 500
downloads (a real popularity floor, not just "exists"), and sorts by
download count descending so the most-watched match leads.

**Verified:** searching "jaws" now returns exactly 4 results, led by the
real 1975 film (33k downloads) - no news, no random clips. "nosferatu"
returns 7 legitimate prints of the actual film, led by a 433k-download
copy. "inception" (not public domain, correctly) returns nothing rather
than a pile of irrelevant noise. Confirmed live in the app: typing "jaws"
in the room's Archive.org search shows only the 4 real results.

---

## 2026-11-06 — Watch Together cleanup: dropdown, shorter codes, fixed theme bug, full-time Screen Share

**Who:** Adrian, with Claude Code, on `feature/watch-ui-and-screenshare`
(branched off `feature/home-join-create-flow`). Touches `VideoPanel.jsx`
(Job 2, Henry) and `WatchPlayer.jsx` (Job 3, John) - flagged for both to
review.

**What we fixed/built, from Adrian's own testing feedback:**
- **Bug fixed:** selecting a theme on the Themes page was force-navigating
  straight to the Create screen. `ThemesPage.jsx` now just toggles the
  selection (and previews it on that page's own background) - creating a
  room is a separate, explicit "Create a Room" button on the same page.
- **Shorter film-inspired room codes** (`lib/roomCode.js`): swapped the
  title list for short, mostly single-word titles ("jaws", "her", "heat")
  instead of long multi-word ones like "mad-max-fury-road".
- **Archive.org's "Browse" link is now a small popup** (same pattern as
  the YouTube/Twitch/Kick finders), not a full tab-swap away from the
  room - and split into separate **Browse Movies** / **Browse Shows**
  links (`feature_films` / `television` collections) instead of one link
  to archive.org's generic, everything-mixed-together movies collection
  page.
- **Fixed the real bug behind "typing a title doesn't find it":**
  `parseArchiveIdentifier` was guessing that any single plain word (e.g.
  "jaws") was probably a literal archive.org identifier and trying to
  load it directly instead of searching - identifiers are rarely a bare
  dictionary word. Now only an actual archive.org `/details/<id>` link
  counts as a direct load; everything else searches. Combined with a new
  **live search-as-you-type** (debounced ~500ms), you can just type a
  title and see results without pressing Search at all.
- **Viewing options are a dropdown now** (`.watch-provider-dropdown`),
  not a row of buttons sitting out all the time - YouTube, Archive.org,
  Twitch (live), Kick (live), and now **Screen Share**.
- **Screen Share promoted to a full-time option, not buried in an
  already-joined call:** picking it from the dropdown calls a new
  `shareScreen()` method `VideoPanel.jsx` exposes via `forwardRef` +
  `useImperativeHandle` (wired through `RoomView.jsx`), which joins the
  call silently - no mic/camera prompts, matching "usable even if no one
  is watching" - if nobody's joined yet, then triggers the existing
  screen-capture flow. `joinCall` now takes optional mic/cam overrides
  instead of always reading the checkbox state for this. The actual video
  still renders in the Video & Screen Share panel below (that's where the
  peer tiles already live); WatchPlayer's side just shows "Sharing your
  screen — see Video & Screen Share below."

**Verified:** reselecting a theme on the Themes page no longer navigates
anywhere; a freshly created room got the code "her" (not a multi-word
string); the dropdown lists all five options and switching between
YouTube/Archive.org/Screen Share works with no cross-talk; typing "jaws"
into the Archive.org box with no Search click produced live results;
selecting Screen Share auto-joined the call with mic and camera both off
(confirmed via the call's own "Unmute"/"Camera on" button states) without
ever showing the "Join the call" form. The actual screen-capture picker
itself couldn't be exercised end-to-end (this session's sandboxed browser
has no real screen to share), so Henry should double check that part for
real.

---

## 2026-11-06 — Reworked Home's create/join flow; film-inspired room codes

**Who:** Adrian, with Claude Code, on `feature/home-join-create-flow`
(branched off `feature/archive-org-watch-together`).

**What changed, from Adrian's own feedback on the current Home page:**
- **Join** no longer shows a room-code textbox up front. "Join with a
  code" is the only control until clicked; clicking it reveals the
  textbox + a "Join" submit button in its place. Submitting blank shows
  "Type a room code to join."; submitting a code for a room that isn't
  currently active (checked via the existing `/api/room-exists`) shows
  "No room found with that code — double-check it, or ask for a fresh
  invite link." instead of silently dropping you into a brand-new, empty
  room under a mistyped code with no indication anything was wrong.
- **Create** no longer has an inline custom-code field on Home either.
  "Create a Room" now goes to a new `/create` screen (new
  `CreateRoomScreen.jsx`) that asks for your name *and* an optional room
  code together, before the room exists - rather than deciding the code
  first and asking for a name after landing in it. Leaving the code blank
  auto-generates one; typing one still gets the existing auto-suffix
  treatment if it's taken (`"inception"` -> `"inception-2"`).
- **Auto-generated codes are film titles now** (`lib/roomCode.js`'s
  `generateRoomCode`), not random letters/numbers - "inception",
  "the-matrix", "spirited-away", etc. Easier to say out loud and remember
  than "xk4m9q"; collisions between two rooms wanting the same title are
  handled by the existing auto-suffix, same as a typed code.
- The Themes gallery's "Select Theme" now routes through this same
  `/create` screen (carrying the chosen theme along) instead of skipping
  straight to a room with only a name prompt, so there's one consistent
  "create a room" entry point app-wide.

**Verified:** Home shows no textbox until "Join with a code" is clicked,
which reveals it in place; submitting empty and submitting a made-up code
each showed the right message; "Create a Room" opens `/create` with name +
optional-code fields, blank code produced a real film-title room
(`edge-of-tomorrow`), and a typed code plus a Themes-selected genre
(Horror) both carried through correctly into the room. No console errors
in any of the above.

---

## 2026-11-06 — Archive.org: real synced playback of legal, public-domain films

**Who:** Adrian, with Claude Code, on `feature/archive-org-watch-together`
(branched off `feature/profile-bio-and-home-cleanup`, since nothing here is
merged to `main` yet).

**Why:** Adrian wants real in-app convenience beyond screen-share for
"watch something together," and the only way to do that *legally* is
content we actually have the right to show. Netflix/Hulu/Disney+/Prime are
out regardless of technique (DMCA, not just a technical wall - even a
Teleparty-style browser extension only works because the viewer stays in
their own authenticated tab; nothing is ever embedded). The Internet
Archive hosts thousands of public-domain films with a free, keyless,
documented API and direct CORS-enabled mp4 files - legal to embed and sync
because copyright has expired, not because of a loophole.

**What we built:**
- `server/archive.js` (new): proxies archive.org's search and metadata
  endpoints (`GET /api/archive/search`, `GET /api/archive/item/:id`) rather
  than calling them from the browser - avoids depending on archive.org's
  CORS behavior and keeps every viewer's browser from hitting it directly.
  No API key needed (archive.org's search/metadata API is free and public).
- `WatchPlayer.jsx`: Archive.org is a second **on-demand** provider
  alongside YouTube (distinct from Twitch/Kick, which stay "live, no
  sync"). The YouTube IFrame Player and a plain `<video>` element are both
  accessed through one small adapter interface (`getPlayerFor`/
  `isPlayerReady`, wrapping a `<video>` as `makeVideoElementPlayer`), so
  the actual drift-correction/conflict-resolution engine - the delicate
  part John's file header calls out - runs completely unmodified for
  either provider; "youtube" vs "archive" only matters at the handful of
  spots that decide which player object to talk to. Search/load reuses the
  exact same UI and `sync:event` "load" shape YouTube already uses, just
  tagged `provider: "archive"` with a resolved mp4 URL in place of a video
  ID.
- Fixed one real cross-talk risk while wiring this up: the hidden YouTube
  player's own `onStateChange` callback didn't check which provider was
  active, so pausing it programmatically on a provider switch could have
  fired a stray "pause" event while Archive.org was actually live. Added
  the missing guard.

**Verified (two-tab, real archive.org item):** searched "night of the
living dead" with no API key needed, got real search results with
thumbnails; loaded a public-domain print (archive.org identifier
`night-of-the-living-dead-1968-horror-mystery-480-x-640.mp-4-converted`)
and confirmed `Content-Type: video/mp4`, open CORS, and byte-range support
via a direct HEAD request first. In the room: leader's play started the
follower's video at the same position; pausing on the leader's side paused
the follower's at the identical timestamp (0:10); seeking on the leader's
scrubber to 33:28 landed the follower on the same frame; switching the
leader back to YouTube mid-session switched the follower too, with no
cross-talk or console errors from the now-hidden, paused archive player.

**Not covered:** real network latency/drift over an actual cross-network
connection (only tested on localhost), and most archive.org items aren't
famous films - search quality depends entirely on what's been uploaded
there and how it's titled.

---

## 2026-11-05 — Theme/About cleanup, user bios, drop the Rooms tab

**Who:** Adrian, with Claude Code, on `feature/profile-bio-and-home-cleanup`
(branched off `fix/room-reload-false-leave`, not `main` — the files this
touches, like `ProfileForm.jsx` and `RoomSettingsDrawer.jsx`, only exist on
that still-unmerged branch).

**What we built:**
- **Theme picking is Themes-only now.** Removed the "Choose a theme"
  gallery from `HomePage.jsx` — a new room from Home always starts Classic;
  pick a theme on its own tab, or change it later from a room's own
  settings drawer. Dropped the now-unused `pendingTheme`/`onSelectTheme`
  wiring between `App.jsx` and `HomePage.jsx`.
- **"About CouchCrew" moved from Settings to Help** (`HelpPage.jsx`) —
  Settings is now just your profile, not app info.
- **Bios.** `ProfileForm.jsx` has a 160-char bio field alongside name/photo,
  saved to `localStorage` (`couchcrew:bio`, new `lib/profile.js`) and sent
  to the server on `room:join`/`profile:update` (`server/index.js` now
  carries `bio` on each member record, same length-capped pattern as
  `avatar`).
- **Tap a name or photo to see someone's profile.** New shared
  `MemberProfileCard.jsx` (avatar, name, bio) opens from two places: a
  member's name in the settings drawer's People list (live data from
  `members`), and an avatar/name in chat. Chat messages now carry a
  snapshot of the sender's `avatar`/`bio` taken at send time (like most
  chat apps) rather than a live lookup, so it still works for someone who's
  since left the room and doesn't retroactively change if they edit their
  profile later.
- **Dropped the Rooms tab.** Its join-by-code form moved onto Home itself
  (you can create *or* join right from the hero), `RoomsPage.jsx` deleted,
  nav link removed, `/rooms` route removed from `router.js` (an old link to
  it now just lands on Home instead of erroring).
- **Recent rooms moved into Settings**, near the top, collapsed by default
  (`<details>`-style toggle) so it doesn't take up space when you don't
  need it — same `lib/recentRooms.js` as before, just relocated from the
  deleted Rooms page.

**Verified:** built (`npm run build`) and ran it live — Home has no theme
gallery and its join form works, Help shows the About text, Settings shows
a collapsed "Recent rooms" that expands on click with no rooms yet, saved
a name+bio and confirmed it's pre-filled next time, joined a room and
confirmed the People list and a chat message's avatar both open the same
profile card with the saved bio, and Themes still creates a themed room
normally. No console errors.

---

## 2026-11-05 — Mic/camera settings reachable from the nav bar, not just a room

**Who:** Adrian, with Claude Code. The 🎙️/🎥 icons in the top-right of the
nav bar (visible on Home and every other page outside a room) were purely
decorative until now - clicking them did nothing.

**What we built:** clicking either icon opens a small popover under them
with the same `MediaDeviceSettings` picker the room settings drawer uses -
so someone can check/pick their mic and camera before ever creating or
joining a room, not only from inside one. Click-away (or the ✕) closes it.
`NavBar.jsx` now reuses `MediaDeviceSettings` rather than duplicating it.

**Verified:** opened the popover from Home and from the Rooms page,
confirmed it shows the same microphone/camera dropdowns as the room
drawer, and that clicking outside it closes it. No console errors.

---

## 2026-11-05 — Combined integration test surfaces an orphaned-timer bug

**Who:** Adrian, with Claude Code. Ran the first real two-person test of
everything together (chat, video call, YouTube sync, the new room settings
drawer and floating chat) rather than each piece in isolation.

**What happened:** while both people's tabs reconnected around the same
time (a dev-server restart mid-test, not a normal user action, but it
exposed a real bug), a stale "X left the room" message appeared in a
brand-new room session. Root cause: the Nov 5 reconnect-grace fix (see
below) deletes a room's `pendingLeaveTimers` map entry once the room empties
out, but never called `clearTimeout` on the timers inside it first. An
already-scheduled timer kept running after the delete, fired later, found
no map entry (harmless on its own), but still went ahead and added its
"left" message and recreated `roomMessages` for that room id - including
for a brand-new room someone had since created with the same code.

**Fixed:** `clearTimeout` every pending timer for a room before dropping
its `pendingLeaveTimers` entry, in the same place the room itself gets torn
down (`server/index.js`).

**Verified:** joined a room solo, closed the tab (empties the room,
scheduling a "left" timer), reopened the same room code within the 3s
grace window (before the fix, this is exactly when the orphaned timer
would later fire into the new session), waited past the window, and
confirmed no stray message appeared in the fresh room's chat. Also
confirmed the rest of the integration (two people, one in a video call
fallback, synced YouTube playback, opening the settings drawer and
switching theme mid-playback) still all works together with no console
errors.

---

## 2026-11-05 — Room settings drawer, floating chat, profile pics, custom codes

**Who:** Adrian, with Claude Code. Driven by Adrian's own flow/convenience
audit of the room (see the bug-bash entry below, and the LOG discussion that
led here): the room header was getting crowded (theme picker, snack bar,
member list all stacked above the content) and several settings people
would want (device choice, a profile photo, picking a memorable room code)
didn't exist yet.

**What we built:**
- **Room settings drawer** (new `RoomSettingsDrawer.jsx`, opened via a ☰
  button top-left of the room): people count + member list, video/mic
  device picker, and profile (name + photo) are open to everyone; theme and
  "make leader" are leader-only sections, matching the existing
  leader-gating pattern. Moved the theme picker and leader member-list out
  of the room header into here.
- **Floating, collapsible chat** (`ChatPanel.jsx` rewrite): collapses to a
  small 💬 toggle (bottom-right, with an unread-count badge) and expands
  into a side panel instead of sitting as a tall box under the watch
  screen. The snack bar (and its 3-click easter egg) moved into the chat
  panel too, since snacks are a chat thing now, not a whole-room header
  fixture — `onFlourish`/`onToast` callbacks passed down from `RoomView` so
  the egg still triggers the same room-wide flourish/toast.
- **Profile pictures** (`lib/avatar.js`, new shared `ProfileForm.jsx` used
  by both the standalone Settings page and the drawer): pick a photo from
  the file/camera picker (no `capture` attribute, so the browser offers
  both gallery and camera - forcing one would hide the other), resized
  client-side to a 128x128 JPEG data URL (a raw phone photo is several MB;
  far too big to broadcast on every presence update) and stored in
  `localStorage`. `server/index.js` now carries `avatar` on each member
  record (capped at `MAX_AVATAR_LENGTH`, silently dropped if over) and a
  new `profile:update` event lets a name/photo change reach the room
  immediately instead of only on next rejoin.
- **Mic/camera device picker** (`lib/devicePrefs.js`,
  `MediaDeviceSettings.jsx`): lists input devices via
  `enumerateDevices()` (with a one-time permission-priming button, since
  labels are blank until a permission's been granted once) and saves the
  chosen ids to `localStorage`. `VideoPanel.jsx`'s `getLocalTracks` now
  reads these as `deviceId: {exact}` constraints, falling back to the
  system default/`facingMode` when unset - closes the "no way to pick a
  different camera/mic" gap flagged earlier, additive only, flagged for
  Henry to double check against his WebRTC rebuild.
- **Delete recent rooms** (`RoomsPage.jsx` + new shared `lib/recentRooms.js`,
  also used by `App.jsx` instead of its old inline copy): a ✕ next to each
  recent room removes it from the `localStorage` list.
- **Custom room codes** (`lib/roomApi.js`, new server endpoint
  `GET /api/room-exists/:code`): Home's "Create a Room" has an optional
  custom-code field. The code is sanitized, checked against the server (a
  room only "exists" while someone's actually in it - there's no separate
  reservation step), and auto-suffixed (`movienight` -> `movienight-2`,
  etc.) if already taken, instead of silently dropping the creator into
  someone else's room.

**Verified:** ran both servers locally and drove it live - opened the
drawer and confirmed people count/device picker/profile form/leader-only
theme section all render and the theme change synced to a second tab
immediately; expanded/collapsed the floating chat and confirmed the snack
easter egg still fires the room flourish+toast from its new home; removed
a room from Recent Rooms and confirmed it disappeared; created a room with
a custom code, then - while a second tab still held that room open -
created another with the same code and got `movienight-2` back, confirming
the auto-suffix. Didn't verify: actually uploading a real photo file (this
session's browser automation can't drive a native file picker), or the
device picker against a machine with multiple real mics/cameras.

---

## 2026-11-05 — Bug bash (local, pre-mobile-testing pass)

**Who:** Adrian, with Claude Code. Ran both servers locally and drove two
browser tabs as "Adrian" and "Henry" in the same room to check the core
flows end to end before the Nov 6-7 mobile testing/bug-bash window.

**Checked and working:** room create/join, chat (realtime, both directions),
leader crown + leader-gated "Watch Together" controls, leader transfer
("Make leader"), genre theme sync across clients, YouTube load + play/pause
reaching the other client, mic/camera graceful fallback ("Couldn't use your
mic or camera (blocked or not found) — you can still watch and listen.")
when `getUserMedia` is unavailable, mobile viewport (375px) layout for the
room view (single column, no overflow), and the Home/Rooms/Themes/Settings/
Help pages (Help's content, Rooms' "recent rooms" from `localStorage`,
Themes gallery) — no console errors on any of them.

**Bug found:** reloading the room page (a plain refresh, not leaving) makes
the *reloading user's own tab* show a system chat message saying **they**
left the room, with no matching "rejoined" message to explain it — even
though the member list at the top still correctly shows them present.

Root cause (`server/index.js`): a reload creates a new socket that calls
`room:join` while the old socket's `disconnect` handler is still unwinding.
The disconnect handler always appends `"${name} left the room"` to the
room's shared message history and broadcasts it via `socket.to(roomId)` —
which reaches every *other* socket in the room, including the new socket
the same person just reconnected with. Their own `room:join` for the
reconnect never shows them their own "joined" message either (intentional
— `socket.to(roomId)` also excludes the sender there), so from that user's
perspective a reload reads as an unexplained, false "you left" notice.
Other members in the room see a more sensible (if slightly noisy)
leave-then-rejoin pair.

**Fixed same session.** Added a 3-second reconnect grace period in
`server/index.js`: a disconnect now schedules the "left the room" message
with `setTimeout` instead of firing it immediately, tracked in a new
`pendingLeaveTimers` map (`roomId -> Map<name, Timeout>`). If `room:join`
sees a same-name reconnect for that room before the timer fires, it clears
the timer and skips adding a new "joined" message too — a reload reads as
nothing happening at all, which is the correct UX for a blip. If no
reconnect comes within the window, the "left" message fires as before, now
via `io.to(roomId)` since the original author's socket is already gone (no
longer needs to exclude the sender).

**Verified:** reran the two-tab repro (Adrian + Henry) against the fix —
reloading Adrian's tab produced no leave message in either tab even after
waiting past the 3s window, member list stayed correct throughout; closing
Adrian's tab for real still correctly showed "Adrian left the room" to
Henry after the grace period and removed Adrian from the member list.

**Also noted, not a bug:** repeated console warnings
`Failed to execute 'postMessage' on 'DOMWindow': ...youtube.com...` while a
video is loaded — these come from the YouTube IFrame Player API's own
internal polling, not CouchCrew's code, and are a known benign noise
pattern for that embed; not worth chasing.

**Not covered this pass:** real camera/mic/WebRTC call quality (this
session's browser has no real camera/mic to grant), filling a room to the
5-person cap to see the "room is full" screen trigger live (re-verified by
reading `server/index.js` and Henry's `room:size-cap` LOG entry instead),
and actual cross-device/cross-network mobile testing (needs a real phone).

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
