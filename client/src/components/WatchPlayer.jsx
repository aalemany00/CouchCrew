// Job 3 (Synced Watch Party Playback) owns this component.
//
// Only the room leader (isLeader prop, from RoomView/server) can load a
// video or control playback — everyone else's iframe is locked
// (pointer-events: none, see .watch-frame.locked) and their load form is
// hidden. The leader's actions broadcast through the server's generic
// "sync:event" relay as { type, ... } objects:
//   load   { videoId, time, playing }  - everyone switches to this video
//   play   { time }
//   pause  { time }
//   seek   { time }
//   tick   { time }                    - heartbeat from whoever last acted, to correct drift
//   request                            - a new joiner asking for the current state
//   state  { videoId, time, playing }  - reply to a request
// Non-YouTube services fall back to VideoPanel's screen share (see LOG.md).
import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";

const DRIFT_THRESHOLD = 2; // seconds of drift before a tick corrects a viewer
const SEEK_THRESHOLD = 1.5; // a jump bigger than this between polls is a seek
const SUPPRESS_MS = 1000; // ignore player events caused by applying a remote one
const CONFLICT_MS = 600; // a remote play/pause/seek this soon after a local one is a conflict
const TICK_MS = 5000;
const POLL_MS = 500;

// YT.PlayerState values
const YT_PLAYING = 1;
const YT_PAUSED = 2;

let apiPromise;
function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

function parseVideoId(input) {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be") return url.pathname.slice(1, 12) || null;
    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

export default function WatchPlayer({ roomId, isLeader }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [hasVideo, setHasVideo] = useState(false);

  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const videoIdRef = useRef(null);
  const pendingRef = useRef(null); // state to apply once the player is ready
  const suppressUntilRef = useRef(0);
  const lastTimeRef = useRef({ time: 0, at: 0 }); // for seek detection
  const controllerRef = useRef(false); // true if the local user acted last
  const lastLocalActionRef = useRef(0); // when the local user last sent play/pause/seek
  const waitingForStateRef = useRef(false);
  const lastKnownRef = useRef(null); // last state seen, used to restore a recreated player
  // Only the room leader controls playback — a ref so the stable callbacks
  // below don't need to be recreated (and the player rebuilt) every time
  // leadership changes.
  const isLeaderRef = useRef(isLeader);
  useEffect(() => {
    isLeaderRef.current = isLeader;
  }, [isLeader]);

  // Events are stamped with our socket id so simultaneous actions from two
  // people resolve the same way on both sides.
  const send = useCallback(
    (event) => {
      if (["play", "pause", "seek"].includes(event.type)) {
        lastLocalActionRef.current = Date.now();
      }
      socket.emit("sync:event", { roomId, event: { ...event, from: socket.id } });
    },
    [roomId]
  );

  const currentState = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current || !videoIdRef.current) return null;
    return {
      videoId: videoIdRef.current,
      time: p.getCurrentTime(),
      playing: p.getPlayerState() === YT_PLAYING,
    };
  }, []);

  // Apply a state to the local player without echoing it back to the room.
  const applyState = useCallback((state) => {
    const p = playerRef.current;
    suppressUntilRef.current = Date.now() + SUPPRESS_MS;
    lastTimeRef.current = { time: state.time, at: Date.now() };
    if (!p || !readyRef.current) {
      pendingRef.current = state;
      return;
    }
    if (videoIdRef.current !== state.videoId) {
      videoIdRef.current = state.videoId;
      if (state.playing) p.loadVideoById(state.videoId, state.time);
      else p.cueVideoById(state.videoId, state.time);
    } else {
      p.seekTo(state.time, true);
      if (state.playing) p.playVideo();
      else p.pauseVideo();
    }
    setHasVideo(true);
  }, []);

  // Create the player once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      const mount = document.createElement("div");
      containerRef.current.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            readyRef.current = true;
            // A recreated player (hot reload) restores whatever was playing.
            const state = pendingRef.current || lastKnownRef.current;
            pendingRef.current = null;
            if (state) applyState(state);
          },
          onStateChange: (e) => {
            if (!isLeaderRef.current) return;
            if (Date.now() < suppressUntilRef.current) return;
            const time = playerRef.current.getCurrentTime();
            if (e.data === YT_PLAYING) {
              controllerRef.current = true;
              send({ type: "play", time });
            } else if (e.data === YT_PAUSED) {
              controllerRef.current = true;
              send({ type: "pause", time });
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      lastKnownRef.current = currentState() || lastKnownRef.current;
      readyRef.current = false;
      videoIdRef.current = null; // the new player starts empty
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [applyState, currentState, send]);

  // Incoming sync events from the rest of the room.
  useEffect(() => {
    function handleSync(event) {
      const p = playerRef.current;
      switch (event.type) {
        case "load":
          waitingForStateRef.current = false;
          controllerRef.current = false;
          applyState(event);
          break;
        case "state":
          // Only the first reply matters, and only to someone who asked.
          if (!waitingForStateRef.current) break;
          waitingForStateRef.current = false;
          applyState(event);
          break;
        case "request": {
          const state = currentState();
          if (state) send({ type: "state", ...state });
          break;
        }
        case "play":
        case "pause":
        case "seek":
          if (!videoIdRef.current) break;
          // Conflict: we acted at the same moment. The lower socket id wins on
          // both sides, so everyone converges on the same state.
          if (
            Date.now() - lastLocalActionRef.current < CONFLICT_MS &&
            event.from > socket.id
          ) {
            break;
          }
          controllerRef.current = false;
          applyState({
            videoId: videoIdRef.current,
            time: event.time,
            playing:
              event.type === "play" ||
              (event.type === "seek" && p?.getPlayerState() === YT_PLAYING),
          });
          break;
        case "tick": {
          if (!p || !readyRef.current || !videoIdRef.current) break;
          if (Math.abs(p.getCurrentTime() - event.time) > DRIFT_THRESHOLD) {
            suppressUntilRef.current = Date.now() + SUPPRESS_MS;
            lastTimeRef.current = { time: event.time, at: Date.now() };
            p.seekTo(event.time, true);
          }
          break;
        }
      }
    }

    // Ask the room what's playing once we've actually joined it.
    function handleJoined() {
      waitingForStateRef.current = true;
      send({ type: "request" });
    }

    socket.on("sync:event", handleSync);
    socket.on("room:joined", handleJoined);
    return () => {
      socket.off("sync:event", handleSync);
      socket.off("room:joined", handleJoined);
    };
  }, [applyState, currentState, send]);

  // Detect local seeks (the YouTube API has no seek event) and send heartbeats.
  useEffect(() => {
    const poll = setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current || !videoIdRef.current) return;
      const now = Date.now();
      const playing = p.getPlayerState() === YT_PLAYING;
      const time = p.getCurrentTime();
      const { time: lastTime, at } = lastTimeRef.current;
      const expected = lastTime + (playing ? (now - at) / 1000 : 0);
      lastTimeRef.current = { time, at: now };
      lastKnownRef.current = { videoId: videoIdRef.current, time, playing };
      if (!isLeaderRef.current) return;
      if (now < suppressUntilRef.current) return;
      if (Math.abs(time - expected) > SEEK_THRESHOLD) {
        controllerRef.current = true;
        send({ type: "seek", time });
      }
    }, POLL_MS);

    const tick = setInterval(() => {
      const state = currentState();
      if (state?.playing && controllerRef.current) {
        send({ type: "tick", time: state.time });
      }
    }, TICK_MS);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [currentState, send]);

  function handleLoad(e) {
    e.preventDefault();
    if (!isLeader) return;
    const videoId = parseVideoId(url);
    if (!videoId) {
      setError("That doesn't look like a YouTube link.");
      return;
    }
    setError("");
    setUrl("");
    const state = { videoId, time: 0, playing: true };
    controllerRef.current = true;
    applyState(state);
    send({ type: "load", ...state });
  }

  // YouTube's own site can't be embedded in the room (they block framing for
  // browsing), so this opens a small popup alongside the room instead of a
  // full tab-switch — search there, copy the link, paste it in below.
  function openYouTubeFinder() {
    const typed = url.trim();
    const target =
      typed && !parseVideoId(typed)
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(typed)}`
        : "https://www.youtube.com";
    window.open(target, "couchcrew-youtube-finder", "width=480,height=760,noopener,noreferrer");
  }

  return (
    <div className="watch-player">
      <h2>Watch Together</h2>
      {isLeader ? (
        <>
          <form className="watch-load" onSubmit={handleLoad}>
            <input
              type="text"
              placeholder="Paste a YouTube link, or type a search and find it →"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit">Load</button>
          </form>
          <button type="button" className="secondary youtube-finder" onClick={openYouTubeFinder}>
            Find on YouTube ↗
          </button>
        </>
      ) : (
        <p className="room-tag">Only the room leader can choose what to play.</p>
      )}
      {error && <p className="watch-error">{error}</p>}
      <div
        className={`watch-frame${isLeader ? "" : " locked"}`}
        hidden={!hasVideo}
        ref={containerRef}
      />
      {!hasVideo && <p className="room-tag">Nothing playing yet. Room: {roomId}</p>}
    </div>
  );
}
