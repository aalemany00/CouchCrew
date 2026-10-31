# CouchCrew — Onboarding for Your Claude Code Session

Paste or attach this whole file to your own Claude Code session before you
start working on this project. It's everything your Claude needs to know
about the assignment and the project — it does not know anything about this
yet, so don't skip it.

---

## Instructions for the Claude Code session reading this file

Before writing any code or making any technical decisions:

1. Ask the person you're working with which job they want to take:
   **Job B (Audio/Video/Screen Share)** or **Job C (Synced Watch Party
   Playback)** — both are described in full below. Wait for their answer.
2. Once they've picked, check out the matching branch (`feature/video-av` for
   Job B, `feature/watch-sync` for Job C) from the repo at
   `https://github.com/aalemany00/CouchCrew`.
3. Read `CLAUDE.md` and `server/index.js` in the repo so you understand the
   realtime backbone (room join/presence, chat, and the `sync:event` relay)
   that your job needs to integrate with — that part is already built and
   shouldn't be changed without coordinating with the team.
4. Before building, interview the person about how *they* want to approach
   their job: what it should look like, what libraries or approach they'd
   prefer beyond the one foundation decision already made (noted per job
   below), what order to build things in. The scope and end goal below are
   fixed; everything about *how* to get there is theirs to decide — don't
   assume an implementation for them.

**This also applies mid-session, not just at the start.** There is no
direct channel between this Claude Code session and Adrian's, Henry's, or
John's — the only shared source of truth is this GitHub repo. So:

- **Before telling your human to ask Adrian something, or assuming a piece
  of backend/shared infrastructure doesn't exist yet: run `git pull origin
  main` and re-read `CLAUDE.md` and `server/index.js` first.** The thing
  you need may already be built and merged — these files are kept current
  as the team's actual coordination mechanism, not just initial context.
  Routing a question through two humans copy-pasting between two Claude
  sessions is slow and wastes everyone's time when the repo already has
  the answer.
- Only surface a question to your human for Adrian if the repo genuinely
  doesn't answer it (e.g. a real design decision, or something that needs
  a secret/credential only Adrian can set).
- If you do build something that touches a file outside your job's owned
  files (per the Job section below), say so explicitly in your PR
  description so it's easy to spot during review.

---

## What this assignment requires (TCSS 490, Artifact 4: "For Someone Else")

- **Shape:** build with a team of 2–3 people, for someone *outside* the
  team. This is a rehearsal for the course's final 5-week project.
- **Due:** Sunday, Nov 8. There's an earlier checkpoint: by Sunday, Nov 1,
  each team member submits their portfolio link showing current progress —
  it does not need to be finished by then, just real.
- **Process the course grades directly:**
  - A written plan agreed on *before* building (this repo's `CLAUDE.md` is
    that plan).
  - Work in branches, merge via reviewed pull requests, so teammates don't
    overwrite each other.
  - A **shared log** (`LOG.md` in the repo) of what was decided, built, or
    abandoned, and why — not optional, it's part of what gets graded.
  - Each person fills in their own portfolio card and submits their own
    portfolio link at the end — the project is shared, the submission isn't.
- **What "complete" means:** the team built something together and handed
  it to the person it's for, the repo has a real log, and your card is on
  your own portfolio. It is explicitly **not graded on polish or size** —
  it's graded on whether you did the real work and can show it.
- **Why AI is in the loop at all:** this course treats using Claude Code
  well — asking it good questions, checking its output, keeping context
  current across sessions — as the actual skill being taught here, not a
  shortcut. Use it for real design decisions, not just to generate code
  blindly.

---

## The project: CouchCrew

**End goal:** a website where any number of people can join a room together
to watch something, with text chat, mic/camera, and screen share — so people
who can't be in the same physical room can still hang out and watch a movie
or show together. No app install, works from a phone browser.

**Who it's actually for:** the person driving this project has a
long-distance partner he watches movies with — this is a real tool he'll
keep using, generalized so it works for anyone in the same situation
(long-distance friends, family, partners — anyone who wants to watch
something together but can't be in the same room).

**Current status:** the realtime backbone is already built and pushed to
`main` — room creation/joining by code, live presence (who's in the room),
and text chat all work end-to-end. The room page has two placeholder panels
waiting for Job B and Job C to fill in. Nothing is deployed yet; everything
currently runs locally.

**Already-decided foundation (don't re-litigate, build within it):**
- Frontend: React + Vite, in `client/`
- Backend: Node + Express + Socket.IO, in `server/` — owns room membership,
  chat, and a generic `sync:event` relay that gets broadcast to everyone in
  a room (this is what synced playback hooks into)
- The whole thing must be usable from a phone browser — no native app

---

## Job B — Audio/Video/Screen Share

**End goal:** anyone in the room who wants to can turn on their mic and/or
camera and be seen and heard by everyone else in the room. Anyone can also
share their screen so the rest of the room can see it — this is also the
project's answer for "watching something on a service that can't be truly
synced" (someone screen-shares their Netflix tab, for example).

**Foundation decision (settled, don't re-litigate):** we started with
Daily.co (a managed WebRTC service) but switched to **Jitsi Meet's free
public server** (`meet.jit.si`) after discovering Daily requires a credit
card on the account even to use its free allowance. Jitsi's public server
needs no account, API key, or payment method — ever, for anyone on the
team, locally or in production.

**Already built, don't rebuild it:** load `https://meet.jit.si/external_api.js`,
then:
```js
const api = new JitsiMeetExternalAPI("meet.jit.si", {
  roomName: `couchcrew-${roomId}`,
  parentNode: containerRef.current,
  width: "100%",
  height: "100%",
  userInfo: { displayName: name },
});
```
No server endpoint is involved — the client talks to Jitsi directly, and
`server/index.js` has no video-related routes at all.

**Yours to decide:** what the video grid looks like, how controls are laid
out, how it behaves on a phone screen, how you handle someone with no
camera/mic at all, anything else about how this feature comes together. The
starting placeholder is `client/src/components/VideoPanel.jsx`.

---

## Job C — Synced Watch Party Playback

**End goal:** when one person in the room plays, pauses, or seeks a video,
everyone else's player follows automatically — so the room is watching the
same moment together, not just separately with a chat window open.

**One foundation decision already made:** start with **YouTube**, since its
IFrame Player API is built for exactly this — it's embeddable and
controllable from code, which the server's `sync:event` relay is already
built to broadcast.

**Open question, not a blocker — time-box your first few days on this:**
can the room sync playback for *other* services too (Netflix, Hulu, etc.)?
These typically use DRM that blocks the obvious approaches (you can't
script or screen-record a DRM'd video element the way you can YouTube), so
there may be nothing workable. Research it for real, then write down what
you found in `LOG.md` either way — "we looked and there's no viable way"
is a legitimate, loggable outcome, not a failure. If nothing pans out,
Job B's screen share already covers "watch anything together," so the
project doesn't depend on this succeeding.

**Yours to decide:** what the player and its controls look like, how you
structure the sync logic, how you handle someone joining mid-video, anything
else about how this feature comes together. The starting placeholder is
`client/src/components/WatchPlayer.jsx`.

---

## Working in the repo

```bash
# clone and get set up
git clone https://github.com/aalemany00/CouchCrew.git
cd CouchCrew
git checkout feature/video-av      # or feature/watch-sync

# backend (separate terminal, needed either way)
cd server && npm install && npm run dev        # http://localhost:3001

# frontend
cd client && npm install && cp .env.example .env && npm run dev   # http://localhost:5173
```

When your piece works, open a pull request into `main` — one of your two
teammates reviews it before it merges. Add an entry to `LOG.md` any time you
make a real decision, hit a dead end, or change direction.
