// Job 3 (Synced Watch Party Playback) owns this component.
//
// Only the room leader (isLeader prop, from RoomView/server) can load a
// video or control playback — everyone else's iframe is locked
// (pointer-events: none, see .watch-frame.locked) and their load form is
// hidden. The leader's actions broadcast through the server's generic
// "sync:event" relay as { type, ... } objects:
//   load   { provider, videoId, time, playing }  (youtube/archive) - everyone switches to this video
//   load   { provider, channel }                 (twitch/kick) - everyone switches to this channel
//   play   { time }                    (youtube/archive only)
//   pause  { time }                    (youtube/archive only)
//   seek   { time }                    (youtube/archive only)
//   tick   { time }                    (youtube/archive only) - heartbeat from whoever last acted, to correct drift
//   request                            - a new joiner asking for the current state
//   state  { provider, videoId, time, playing } or { provider, channel } - reply to a request
//
// Twitch and Kick are live, so there's no play/pause/seek to keep in sync -
// everyone's iframe just points at the same channel, already the same
// broadcast. Added 2026-11-04 (Adrian, flagged for John's review - see
// LOG.md): kept entirely additive so the YouTube sync logic below (the
// part that's actually delicate - drift correction, conflict resolution)
// is untouched when provider is "youtube", which stays the default.
//
// Added 2026-11-06 (Adrian, flagged for John's review - see LOG.md):
// Archive.org (public-domain films, playable/legal to show in-app unlike
// Netflix/Hulu/etc.) is a second on-demand provider alongside YouTube. The
// YT-specific player object and the plain <video> element used for
// Archive.org are both accessed through the same small adapter interface
// (getPlayerFor/isPlayerReady below) so all of the drift-correction/
// conflict-resolution logic that follows runs unmodified for either one -
// "youtube" vs "archive" only matters at the handful of spots that decide
// *which* player object to talk to.
import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const ON_DEMAND_PROVIDERS = new Set(["youtube", "archive"]);

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

// Archive.org search/lookup, proxied through our own server (server/archive.js)
// rather than called directly so we're not relying on archive.org's CORS
// behavior. No API key needed - unlike YouTube, this always works.
async function searchArchiveVideos(query) {
  const res = await fetch(`${SERVER_URL}/api/archive/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Archive.org search failed (${res.status})`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    identifier: item.identifier,
    title: item.title,
    year: item.year,
    thumbnail: `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,
  }));
}

async function resolveArchiveItem(identifier) {
  const res = await fetch(`${SERVER_URL}/api/archive/item/${encodeURIComponent(identifier)}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Archive.org lookup failed (${res.status})`);
  return body; // { url, title }
}

// Only a real archive.org /details/<identifier> link counts as a direct
// load - anything else (including a single plain word that happens to look
// like it could be an identifier, e.g. "jaws") is always treated as a
// search query instead. Guessing "that bare word is probably an exact
// identifier" was the bug behind "just typing a title doesn't find it" -
// real identifiers are rarely a plain dictionary word anyway.
function parseArchiveIdentifier(input) {
  const text = input.trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (!parsed.hostname.endsWith("archive.org")) return null;
    const match = parsed.pathname.match(/^\/details\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Seeking before a freshly-assigned <video> has loaded its metadata is
// silently ignored by the browser (duration/seekable range aren't known
// yet) - wait for it when that's the case, same as the YouTube player
// already handles via its own onReady/pendingRef.
function seekWhenReady(videoEl, time) {
  if (videoEl.readyState >= 1) {
    videoEl.currentTime = time;
    return;
  }
  const onLoaded = () => {
    videoEl.currentTime = time;
    videoEl.removeEventListener("loadedmetadata", onLoaded);
  };
  videoEl.addEventListener("loadedmetadata", onLoaded);
}

// Wraps a plain <video> element in the same small interface the YouTube
// IFrame Player already exposes, so applyState/currentState/handleSync
// below can talk to either one without knowing which is active.
function makeVideoElementPlayer(videoEl) {
  return {
    getCurrentTime: () => videoEl.currentTime || 0,
    getPlayerState: () => (videoEl.paused ? YT_PAUSED : YT_PLAYING),
    seekTo: (time) => seekWhenReady(videoEl, time),
    playVideo: () => videoEl.play().catch(() => {}),
    pauseVideo: () => videoEl.pause(),
    loadVideoById: (src, time) => {
      if (videoEl.src !== src) videoEl.src = src;
      seekWhenReady(videoEl, time);
      videoEl.play().catch(() => {});
    },
    cueVideoById: (src, time) => {
      if (videoEl.src !== src) videoEl.src = src;
      seekWhenReady(videoEl, time);
      videoEl.pause();
    },
  };
}

const ARCHIVE_SEARCH_DEBOUNCE_MS = 500; // live-search-as-you-type delay

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

export default function WatchPlayer({ roomId, isLeader, onShareScreen }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [provider, setProvider] = useState("youtube"); // "youtube" | "archive" | "twitch" | "kick" | "screenshare"
  const [liveChannel, setLiveChannel] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Movie volume: purely local (never sent to the room), remembered in this
  // browser. Applies to the YouTube and Archive.org players; the live-stream
  // embeds (Twitch/Kick) are cross-origin iframes we can't control.
  const [movieVol, setMovieVol] = useState(() => {
    try {
      const saved = localStorage.getItem("couchcrew:movieVolume");
      const v = saved === null ? NaN : Number(saved); // nothing saved yet -> full volume (Number(null) would be 0)
      return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 100;
    } catch {
      return 100;
    }
  });
  const [movieMuted, setMovieMuted] = useState(false);
  const movieAudioRef = useRef({ vol: 100, muted: false });

  const providerRef = useRef(provider);
  useEffect(() => {
    providerRef.current = provider;
    // Switching away from a provider hides its player (CSS), but it would
    // otherwise keep playing (and its audio running) in the background -
    // pause whichever one we just left.
    if (provider !== "youtube") playerRef.current?.pauseVideo?.();
    if (provider !== "archive") archiveVideoElRef.current?.pause();
  }, [provider]);
  const liveChannelRef = useRef(liveChannel);
  useEffect(() => {
    liveChannelRef.current = liveChannel;
  }, [liveChannel]);

  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const archiveVideoElRef = useRef(null);
  const readyRef = useRef(false);

  const applyMovieAudio = useCallback(() => {
    const { vol, muted } = movieAudioRef.current;
    const yt = playerRef.current;
    if (readyRef.current && yt?.setVolume) {
      yt.setVolume(vol);
      if (muted) yt.mute();
      else yt.unMute();
    }
    const el = archiveVideoElRef.current;
    if (el) {
      el.volume = vol / 100;
      el.muted = muted;
    }
  }, []);
  useEffect(() => {
    movieAudioRef.current = { vol: movieVol, muted: movieMuted };
    applyMovieAudio();
    try {
      localStorage.setItem("couchcrew:movieVolume", String(movieVol));
    } catch {
      /* remembering the volume is a convenience only */
    }
  }, [movieVol, movieMuted, provider, hasVideo, applyMovieAudio]);
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

  // The two on-demand providers are accessed through this one interface
  // (see makeVideoElementPlayer above) - everything below that calls
  // getPlayerFor/isPlayerReady works the same whichever is active.
  function getPlayerFor(providerName) {
    if (providerName === "archive") {
      return archiveVideoElRef.current ? makeVideoElementPlayer(archiveVideoElRef.current) : null;
    }
    return playerRef.current;
  }
  function isPlayerReady(providerName) {
    return providerName === "archive" ? !!archiveVideoElRef.current : readyRef.current;
  }

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
    const activeProvider = providerRef.current;
    const p = getPlayerFor(activeProvider);
    if (!p || !isPlayerReady(activeProvider) || !videoIdRef.current) return null;
    return {
      videoId: videoIdRef.current,
      time: p.getCurrentTime(),
      playing: p.getPlayerState() === YT_PLAYING,
    };
  }, []);

  // Apply a state to the local player without echoing it back to the room.
  // `forProvider` lets a remote "load"/"state" event target the provider it
  // names even before the providerRef effect has caught up with a setProvider
  // call made earlier in the same handler.
  const applyState = useCallback((state, forProvider) => {
    const activeProvider = forProvider || providerRef.current;
    const p = getPlayerFor(activeProvider);
    suppressUntilRef.current = Date.now() + SUPPRESS_MS;
    lastTimeRef.current = { time: state.time, at: Date.now() };
    if (!p || !isPlayerReady(activeProvider)) {
      pendingRef.current = { ...state, provider: activeProvider };
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
            applyMovieAudio();
            // A recreated player (hot reload) restores whatever was playing
            // - but only if that was actually a YouTube video; a state
            // saved while Archive.org was active belongs to the <video>
            // element instead, which doesn't go through this callback.
            const state = pendingRef.current || lastKnownRef.current;
            pendingRef.current = null;
            if (state?.provider === "youtube") applyState(state, "youtube");
          },
          onStateChange: (e) => {
            if (!isLeaderRef.current || providerRef.current !== "youtube") return;
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
      const snapshot = currentState();
      if (snapshot) lastKnownRef.current = { ...snapshot, provider: providerRef.current };
      readyRef.current = false;
      videoIdRef.current = null; // the new player starts empty
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [applyState, currentState, send, applyMovieAudio]);

  // Incoming sync events from the rest of the room.
  useEffect(() => {
    function handleSync(event) {
      const eventProvider = event.provider || "youtube";
      switch (event.type) {
        case "load":
          waitingForStateRef.current = false;
          if (!ON_DEMAND_PROVIDERS.has(eventProvider)) {
            setProvider(eventProvider);
            setLiveChannel(event.channel);
            setHasVideo(true);
            break;
          }
          setProvider(eventProvider);
          setLiveChannel(null);
          controllerRef.current = false;
          applyState(event, eventProvider);
          break;
        case "state":
          // Only the first reply matters, and only to someone who asked.
          if (!waitingForStateRef.current) break;
          waitingForStateRef.current = false;
          if (!ON_DEMAND_PROVIDERS.has(eventProvider)) {
            setProvider(eventProvider);
            setLiveChannel(event.channel);
            setHasVideo(true);
            break;
          }
          setProvider(eventProvider);
          setLiveChannel(null);
          applyState(event, eventProvider);
          break;
        case "request": {
          if (!ON_DEMAND_PROVIDERS.has(providerRef.current)) {
            if (liveChannelRef.current) {
              send({ type: "state", provider: providerRef.current, channel: liveChannelRef.current });
            }
            break;
          }
          const state = currentState();
          if (state) send({ type: "state", provider: providerRef.current, ...state });
          break;
        }
        case "play":
        case "pause":
        case "seek":
          if (!ON_DEMAND_PROVIDERS.has(providerRef.current)) break;
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
              (event.type === "seek" && getPlayerFor(providerRef.current)?.getPlayerState() === YT_PLAYING),
          });
          break;
        case "tick": {
          if (!ON_DEMAND_PROVIDERS.has(providerRef.current)) break;
          const p = getPlayerFor(providerRef.current);
          if (!p || !isPlayerReady(providerRef.current) || !videoIdRef.current) break;
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

  // Detect local seeks (the YouTube API has no seek event; this doubles as
  // the mechanism for Archive.org's native <video> too, for consistency)
  // and send heartbeats.
  useEffect(() => {
    const poll = setInterval(() => {
      const activeProvider = providerRef.current;
      const p = getPlayerFor(activeProvider);
      if (!p || !isPlayerReady(activeProvider) || !videoIdRef.current) return;
      const now = Date.now();
      const playing = p.getPlayerState() === YT_PLAYING;
      const time = p.getCurrentTime();
      const { time: lastTime, at } = lastTimeRef.current;
      const expected = lastTime + (playing ? (now - at) / 1000 : 0);
      lastTimeRef.current = { time, at: now };
      lastKnownRef.current = { videoId: videoIdRef.current, time, playing, provider: activeProvider };
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
    applyState(state, "youtube");
    send({ type: "load", provider: "youtube", ...state });
  }

  async function loadArchiveItem(identifier) {
    setError("");
    setSearching(true);
    try {
      const { url: mediaUrl } = await resolveArchiveItem(identifier);
      setUrl("");
      setSearchResults(null);
      const state = { videoId: mediaUrl, time: 0, playing: true };
      controllerRef.current = true;
      applyState(state, "archive");
      send({ type: "load", provider: "archive", ...state });
    } catch (err) {
      setError(err.message || "Couldn't load that item.");
    } finally {
      setSearching(false);
    }
  }

  async function handleLoadArchive() {
    const identifier = parseArchiveIdentifier(url);
    if (identifier) {
      await loadArchiveItem(identifier);
      return;
    }
    if (!url.trim()) {
      setError("Type something to search for.");
      return;
    }
    setError("");
    setSearching(true);
    try {
      const results = await searchArchiveVideos(url.trim());
      setSearchResults(results);
      if (results.length === 0) setError("No results — try a different search.");
    } catch (err) {
      setError(err.message || "Search failed.");
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }

  // Live search-as-you-type for Archive.org: no need to press Search just
  // to find out whether a title is there. A real archive.org link still
  // takes the direct-load path above instead of searching for itself.
  useEffect(() => {
    if (provider !== "archive") return;
    const trimmed = url.trim();
    if (!trimmed || parseArchiveIdentifier(trimmed)) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchArchiveVideos(trimmed);
        setSearchResults(results);
        setError(results.length === 0 ? "No results — try a different search." : "");
      } catch {
        // Stay quiet on a live-typing failure - the Search button still
        // works and shows a real error if pressed.
      } finally {
        setSearching(false);
      }
    }, ARCHIVE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url, provider]);

  async function handleLoad(e) {
    e.preventDefault();
    if (!isLeader) return;
    if (provider === "archive") {
      await handleLoadArchive();
      return;
    }
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

  // Archive.org's native <video> controls, for when the leader interacts
  // with them directly - mirrors the YouTube player's onStateChange above.
  function handleArchivePlay() {
    if (!isLeaderRef.current || providerRef.current !== "archive") return;
    if (Date.now() < suppressUntilRef.current) return;
    controllerRef.current = true;
    send({ type: "play", time: archiveVideoElRef.current?.currentTime || 0 });
  }
  function handleArchivePause() {
    if (!isLeaderRef.current || providerRef.current !== "archive") return;
    if (Date.now() < suppressUntilRef.current) return;
    controllerRef.current = true;
    send({ type: "pause", time: archiveVideoElRef.current?.currentTime || 0 });
  }

  function switchProvider(nextProvider) {
    setProvider(nextProvider);
    setError("");
    setSearchResults(null);
    setMenuOpen(false);
  }

  // Screen Share is a "viewing option" like YouTube/Archive.org rather than
  // something buried inside an already-joined call - picking it broadcasts
  // to the room (same as loading a video) and triggers VideoPanel's actual
  // screen-capture via the ref RoomView wires up, joining the call silently
  // (no mic/cam) first if nobody's done that yet.
  function handleSelectScreenShare() {
    setProvider("screenshare");
    setLiveChannel(null);
    setHasVideo(true);
    setError("");
    setSearchResults(null);
    setMenuOpen(false);
    send({ type: "load", provider: "screenshare" });
    onShareScreen?.();
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

  // A small popup, like the other finders above, not a full tab-swap -
  // separate links for movies vs. TV shows, since archive.org's generic
  // "movies" collection page mixes in everything (shorts, TV, etc.) above
  // the fold instead of just what you're looking for.
  function openArchiveBrowse(kind) {
    const target =
      kind === "shows" ? "https://archive.org/details/television" : "https://archive.org/details/feature_films";
    window.open(target, `couchcrew-archive-${kind}`, "width=480,height=760,noopener,noreferrer");
  }

  const liveConfig = LIVE_PROVIDERS[provider] || null;
  const PROVIDER_LABELS = { youtube: "YouTube", archive: "Archive.org", screenshare: "Screen Share" };
  const currentProviderLabel = liveConfig ? `${liveConfig.label} (live)` : PROVIDER_LABELS[provider] || provider;

  return (
    <div className="watch-player">
      <h2>Watch Together</h2>
      {isLeader && (
        <div className="watch-provider-dropdown">
          <button
            type="button"
            className="provider-dropdown-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            {currentProviderLabel} <span aria-hidden="true">{menuOpen ? "▲" : "▼"}</span>
          </button>
          {menuOpen && (
            <>
              <div className="dropdown-backdrop" onClick={() => setMenuOpen(false)} />
              <ul className="provider-dropdown-menu">
                <li>
                  <button
                    type="button"
                    className={provider === "youtube" ? "active" : ""}
                    onClick={() => switchProvider("youtube")}
                  >
                    YouTube
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={provider === "archive" ? "active" : ""}
                    onClick={() => switchProvider("archive")}
                  >
                    Archive.org
                  </button>
                </li>
                {Object.entries(LIVE_PROVIDERS).map(([id, cfg]) => (
                  <li key={id}>
                    <button
                      type="button"
                      className={provider === id ? "active" : ""}
                      onClick={() => switchProvider(id)}
                    >
                      {cfg.label} (live)
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className={provider === "screenshare" ? "active" : ""}
                    onClick={handleSelectScreenShare}
                  >
                    Screen Share
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      )}
      {isLeader && provider !== "screenshare" ? (
        <>
          <form className="watch-load" onSubmit={handleLoad}>
            <input
              type="text"
              placeholder={
                liveConfig
                  ? liveConfig.placeholder
                  : provider === "archive"
                    ? "Archive.org link or identifier, or type a search and press Search"
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
                : provider === "archive"
                  ? parseArchiveIdentifier(url)
                    ? "Load"
                    : "Search"
                  : provider === "youtube" && YOUTUBE_API_KEY && !parseVideoId(url)
                    ? "Search"
                    : "Load"}
            </button>
          </form>
          {searchResults && provider === "youtube" && (
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
          {searchResults && provider === "archive" && (
            <ul className="youtube-search-results">
              {searchResults.map((r) => (
                <li key={r.identifier}>
                  <button type="button" onClick={() => loadArchiveItem(r.identifier)}>
                    {r.thumbnail && <img src={r.thumbnail} alt="" />}
                    <span>
                      <span className="result-title">{r.title}</span>
                      <span className="result-channel">{r.year || "Archive.org"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {provider === "youtube" && (
            <button type="button" className="secondary youtube-finder" onClick={openYouTubeFinder}>
              Find on YouTube ↗
            </button>
          )}
          {provider === "archive" && (
            <div className="archive-browse-links">
              <button type="button" className="secondary youtube-finder" onClick={() => openArchiveBrowse("movies")}>
                Browse Movies ↗
              </button>
              <button type="button" className="secondary youtube-finder" onClick={() => openArchiveBrowse("shows")}>
                Browse Shows ↗
              </button>
            </div>
          )}
          {liveConfig && (
            <button type="button" className="secondary youtube-finder" onClick={openLiveFinder}>
              Find on {liveConfig.label} ↗
            </button>
          )}
        </>
      ) : provider === "screenshare" ? (
        <p className="room-tag">
          {isLeader
            ? "Sharing your screen — it's on the big screen."
            : "The leader is sharing their screen — it's on the big screen."}
        </p>
      ) : (
        <p className="room-tag">Only the room leader can choose what to play.</p>
      )}
      {error && <p className="watch-error">{error}</p>}
      <div
        className={`watch-frame${isLeader ? "" : " locked"}`}
        hidden={!hasVideo || provider !== "youtube"}
        ref={containerRef}
      />
      {/* Always rendered (just hidden) rather than conditional on provider
          so archiveVideoElRef stays attached across a provider switch -
          see makeVideoElementPlayer/getPlayerFor above. */}
      <video
        ref={archiveVideoElRef}
        className={`watch-frame${isLeader ? "" : " locked"}`}
        hidden={!hasVideo || provider !== "archive"}
        controls
        onPlay={handleArchivePlay}
        onPause={handleArchivePause}
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
      {hasVideo && (provider === "youtube" || provider === "archive") && (
        <div className="movie-volume" title="Movie volume (only changes it for you)">
          <button
            type="button"
            className="secondary"
            aria-label={movieMuted || movieVol === 0 ? "Unmute the movie" : "Mute the movie"}
            onClick={() => setMovieMuted((m) => !m)}
          >
            {movieMuted || movieVol === 0 ? "🔇" : "🔊"}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={movieMuted ? 0 : movieVol}
            aria-label="Movie volume (only for you)"
            onChange={(e) => {
              const v = Number(e.target.value);
              setMovieVol(v);
              setMovieMuted(v === 0);
            }}
          />
        </div>
      )}
      {!hasVideo && <p className="room-tag">Nothing playing yet. Room: {roomId}</p>}
    </div>
  );
}
