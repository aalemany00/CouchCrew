// Job 3 (Synced Watch Party Playback) owns this component.
//
// Only the room leader (isLeader prop, from RoomView/server) can load a
// video or control playback — everyone else's iframe is locked
// (pointer-events: none, see .watch-frame.locked) and their load form is
// hidden. The leader's actions broadcast through the server's generic
// "sync:event" relay as { type, ... } objects:
//   load   { provider, videoId, time, playing }  (youtube) - everyone switches to this video
//   load   { provider, channel }                 (twitch/kick) - everyone switches to this channel
//   play   { time }                    (youtube only)
//   pause  { time }                    (youtube only)
//   seek   { time }                    (youtube only)
//   tick   { time }                    (youtube only) - heartbeat from whoever last acted, to correct drift
//   request                            - a new joiner asking for the current state
//   state  { provider, videoId, time, playing } or { provider, channel } - reply to a request
//
// Twitch and Kick are live, so there's no play/pause/seek to keep in sync -
// everyone's iframe just points at the same channel, already the same
// broadcast. Added 2026-11-04 (Adrian, flagged for John's review - see
// LOG.md): kept entirely additive so the YouTube sync logic below (the
// part that's actually delicate - drift correction, conflict resolution)
// is untouched when provider is "youtube", which stays the default.
import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";

const LIVE_PROVIDERS = {
  twitch: {
    label: "Twitch",
    placeholder: "Twitch channel name, or type a search and find it →",
    parseChannel: (input) => {
      const text = input.trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "");
      return /^[a-zA-Z0-9_]{1,25}$/.test(text) ? text.toLowerCase() : null;
    },
    embedUrl: (channel) =>
      `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${window.location.hostname}&muted=false`,
    // Twitch's own site can't be embedded for browsing (same reason as
    // YouTube), so this opens a popup to search there instead - no API
    // key/developer account needed, same pattern as the YouTube finder.
    searchUrl: (query) => `https://www.twitch.tv/search?term=${encodeURIComponent(query)}`,
    homeUrl: "https://www.twitch.tv/directory",
  },
  kick: {
    label: "Kick",
    placeholder: "Kick username, or type a search and find it →",
    parseChannel: (input) => {
      const text = input.trim().replace(/^https?:\/\/(www\.)?kick\.com\//i, "");
      return /^[a-zA-Z0-9_]{1,25}$/.test(text) ? text.toLowerCase() : null;
    },
    embedUrl: (channel) => `https://player.kick.com/${encodeURIComponent(channel)}`,
    searchUrl: (query) => `https://kick.com/search?query=${encodeURIComponent(query)}`,
    homeUrl: "https://kick.com",
  },
};

// Real in-app search via the YouTube Data API (free, no card - a project
// just needs the API enabled and a key under Credentials; see .env.example).
// Optional: if no key is configured, the "Find on YouTube" popup below is
// still there as a fallback, so this never breaks for someone without one.
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

async function searchYouTubeVideos(query) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "8",
    q: query,
    key: YOUTUBE_API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `YouTube search failed (${res.status})`);
  }
  const data = await res.json();
  return (data.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.default?.url,
  }));
}

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
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [provider, setProvider] = useState("youtube"); // "youtube" | "twitch" | "kick"
  const [liveChannel, setLiveChannel] = useState(null);

  const providerRef = useRef(provider);
  useEffect(() => {
    providerRef.current = provider;
    // Switching to a live channel hides the YouTube container (CSS), but a
    // video playing inside it would otherwise keep its audio running in the
    // background - pause it explicitly.
    if (provider !== "youtube") {
      playerRef.current?.pauseVideo?.();
    }
  }, [provider]);
  const liveChannelRef = useRef(liveChannel);
  useEffect(() => {
    liveChannelRef.current = liveChannel;
  }, [liveChannel]);

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
      const eventProvider = event.provider || "youtube";
      switch (event.type) {
        case "load":
          waitingForStateRef.current = false;
          if (eventProvider !== "youtube") {
            setProvider(eventProvider);
            setLiveChannel(event.channel);
            setHasVideo(true);
            break;
          }
          setProvider("youtube");
          setLiveChannel(null);
          controllerRef.current = false;
          applyState(event);
          break;
        case "state":
          // Only the first reply matters, and only to someone who asked.
          if (!waitingForStateRef.current) break;
          waitingForStateRef.current = false;
          if (eventProvider !== "youtube") {
            setProvider(eventProvider);
            setLiveChannel(event.channel);
            setHasVideo(true);
            break;
          }
          setProvider("youtube");
          setLiveChannel(null);
          applyState(event);
          break;
        case "request": {
          if (providerRef.current !== "youtube") {
            if (liveChannelRef.current) {
              send({ type: "state", provider: providerRef.current, channel: liveChannelRef.current });
            }
            break;
          }
          const state = currentState();
          if (state) send({ type: "state", provider: "youtube", ...state });
          break;
        }
        case "play":
        case "pause":
        case "seek":
          if (providerRef.current !== "youtube") break;
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
          if (providerRef.current !== "youtube") break;
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

  function loadYouTubeVideo(videoId) {
    setError("");
    setUrl("");
    setSearchResults(null);
    const state = { videoId, time: 0, playing: true };
    controllerRef.current = true;
    applyState(state);
    send({ type: "load", provider: "youtube", ...state });
  }

  async function handleLoad(e) {
    e.preventDefault();
    if (!isLeader) return;
    if (provider !== "youtube") {
      handleLoadLive(e);
      return;
    }
    const videoId = parseVideoId(url);
    if (videoId) {
      loadYouTubeVideo(videoId);
      return;
    }
    // Not a link/ID - search in-app if a key is configured, otherwise fall
    // back to the "Find on YouTube" popup (still available either way).
    if (!YOUTUBE_API_KEY || !url.trim()) {
      setError(
        YOUTUBE_API_KEY ? "Type something to search for." : "That doesn't look like a YouTube link."
      );
      return;
    }
    setError("");
    setSearching(true);
    try {
      const results = await searchYouTubeVideos(url.trim());
      setSearchResults(results);
      if (results.length === 0) setError("No results — try a different search.");
    } catch (err) {
      setError(err.message || "Search failed.");
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }

  // Twitch/Kick are live, so "loading" just means pointing everyone's iframe
  // at the same channel - no play/pause/seek state to keep in sync.
  function handleLoadLive() {
    const config = LIVE_PROVIDERS[provider];
    const channel = config.parseChannel(url);
    if (!channel) {
      setError(`That doesn't look like a ${config.label} channel.`);
      return;
    }
    setError("");
    setUrl("");
    setLiveChannel(channel);
    setHasVideo(true);
    send({ type: "load", provider, channel });
  }

  function switchProvider(nextProvider) {
    setProvider(nextProvider);
    setError("");
    setSearchResults(null);
  }

  // None of these services' own sites can be embedded in the room for
  // browsing, so this opens a small popup alongside the room instead of a
  // full tab-switch — search there, copy the channel/link, paste it below.
  function openYouTubeFinder() {
    const typed = url.trim();
    const target =
      typed && !parseVideoId(typed)
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(typed)}`
        : "https://www.youtube.com";
    window.open(target, "couchcrew-youtube-finder", "width=480,height=760,noopener,noreferrer");
  }

  function openLiveFinder() {
    const typed = url.trim();
    const target = typed ? liveConfig.searchUrl(typed) : liveConfig.homeUrl;
    window.open(target, `couchcrew-${provider}-finder`, "width=480,height=760,noopener,noreferrer");
  }

  const liveConfig = provider !== "youtube" ? LIVE_PROVIDERS[provider] : null;

  return (
    <div className="watch-player">
      <h2>Watch Together</h2>
      {isLeader && (
        <div className="watch-provider-tabs">
          <button
            type="button"
            className={`provider-tab${provider === "youtube" ? " active" : ""}`}
            onClick={() => switchProvider("youtube")}
          >
            YouTube
          </button>
          {Object.entries(LIVE_PROVIDERS).map(([id, cfg]) => (
            <button
              key={id}
              type="button"
              className={`provider-tab${provider === id ? " active" : ""}`}
              onClick={() => switchProvider(id)}
            >
              {cfg.label} (live)
            </button>
          ))}
        </div>
      )}
      {isLeader ? (
        <>
          <form className="watch-load" onSubmit={handleLoad}>
            <input
              type="text"
              placeholder={
                liveConfig
                  ? liveConfig.placeholder
                  : YOUTUBE_API_KEY
                    ? "Paste a YouTube link, or type a search and press Search"
                    : "Paste a YouTube link, or type a search and find it →"
              }
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" disabled={searching}>
              {searching
                ? "Searching…"
                : provider === "youtube" && YOUTUBE_API_KEY && !parseVideoId(url)
                  ? "Search"
                  : "Load"}
            </button>
          </form>
          {searchResults && (
            <ul className="youtube-search-results">
              {searchResults.map((r) => (
                <li key={r.videoId}>
                  <button type="button" onClick={() => loadYouTubeVideo(r.videoId)}>
                    {r.thumbnail && <img src={r.thumbnail} alt="" />}
                    <span>
                      <span className="result-title">{r.title}</span>
                      <span className="result-channel">{r.channel}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {provider === "youtube" ? (
            <button type="button" className="secondary youtube-finder" onClick={openYouTubeFinder}>
              Find on YouTube ↗
            </button>
          ) : (
            <button type="button" className="secondary youtube-finder" onClick={openLiveFinder}>
              Find on {liveConfig.label} ↗
            </button>
          )}
        </>
      ) : (
        <p className="room-tag">Only the room leader can choose what to play.</p>
      )}
      {error && <p className="watch-error">{error}</p>}
      <div
        className={`watch-frame${isLeader ? "" : " locked"}`}
        hidden={!hasVideo || !!liveConfig}
        ref={containerRef}
      />
      {liveConfig && liveChannel && (
        <iframe
          key={`${provider}-${liveChannel}`}
          className={`watch-frame${isLeader ? "" : " locked"}`}
          src={liveConfig.embedUrl(liveChannel)}
          title={`${liveConfig.label} stream`}
          allowFullScreen
        />
      )}
      {!hasVideo && <p className="room-tag">Nothing playing yet. Room: {roomId}</p>}
    </div>
  );
}
