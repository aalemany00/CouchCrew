import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { THEME_EASTER_EGGS } from "../lib/theater";
import { getSavedAvatar } from "../lib/avatar";
import { getSavedBio } from "../lib/profile";
import { getToken } from "../lib/auth";
import ChatPanel from "./ChatPanel";
import VideoPanel from "./VideoPanel";
import WatchPlayer from "./WatchPlayer";
import PixelTheaterScenery from "./PixelTheaterScenery";
import RoomSettingsDrawer from "./RoomSettingsDrawer";

const MARQUEE_CLICKS_TO_REVEAL = 5;
const MARQUEE_CLICK_WINDOW_MS = 2000;
const HOLD_TO_LEAVE_MS = 3000;
const LEAVE_MESSAGE_MS = 900;

export default function RoomView({ roomId, name, initialTheme, onLeave }) {
  const [members, setMembers] = useState([]);
  const [leaderId, setLeaderId] = useState(null);
  const [theme, setTheme] = useState("classic");
  const [connected, setConnected] = useState(socket.connected);
  const [linkCopied, setLinkCopied] = useState(false);
  const [toast, setToast] = useState(null); // { text }
  const [flourish, setFlourish] = useState(null); // "flicker" | "shake" | "hearts" | "confetti"
  const [creditsVisible, setCreditsVisible] = useState(false);
  const [leaving, setLeaving] = useState(false); // theatrical pause before actually leaving
  const [roomFull, setRoomFull] = useState(null); // { max } once the server rejects a full room
  const [settingsOpen, setSettingsOpen] = useState(false);

  const amLeader = connected && leaderId === socket.id;
  const videoPanelRef = useRef(null);

  const marqueeClicksRef = useRef([]);
  const toastTimeoutRef = useRef(null);
  const flourishTimeoutRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const holdFillRef = useRef(null);
  // The chat-message listener (inside the socket effect below) needs the
  // current theme to check egg trigger words, but theme must NOT be in that
  // effect's dependency array — doing so would reconnect the socket (and
  // wipe a single-member room's state) every time the leader changes it.
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  // Same reasoning: read via ref inside the socket effect instead of adding
  // as a dependency. Only meaningfully used once, when creating a new room.
  const initialThemeRef = useRef(initialTheme);
  useEffect(() => {
    initialThemeRef.current = initialTheme;
  }, [initialTheme]);
  const initialThemeAppliedRef = useRef(false);

  function showToast(text) {
    setToast({ text });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }

  function playFlourish(effect) {
    setFlourish(effect);
    clearTimeout(flourishTimeoutRef.current);
    flourishTimeoutRef.current = setTimeout(() => setFlourish(null), 2200);
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}/r/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this link to invite someone:", url);
    }
  }

  function transferLeader(toSocketId) {
    socket.emit("leader:transfer", { roomId, toSocketId });
  }

  function setRoomTheme(nextTheme) {
    socket.emit("theme:set", { roomId, theme: nextTheme });
  }

  // Easter egg: click the marquee title 5 times within 2s to reveal credits.
  function handleMarqueeClick() {
    const now = Date.now();
    const recent = marqueeClicksRef.current.filter((t) => now - t < MARQUEE_CLICK_WINDOW_MS);
    recent.push(now);
    marqueeClicksRef.current = recent;
    if (recent.length >= MARQUEE_CLICKS_TO_REVEAL) {
      marqueeClicksRef.current = [];
      setCreditsVisible((v) => !v);
    }
  }

  // Pushes a name/avatar change made in the room settings drawer to the
  // server right away, instead of only taking effect on the next rejoin.
  function handleProfileSave({ name, avatar, bio }) {
    socket.emit("profile:update", { roomId, name, avatar, bio });
  }

  // Hold-to-leave: holding for 3s shows a theatrical pause, then leaves. A
  // quick click does nothing, so leaving a room someone's enjoying takes a
  // deliberate beat.
  function startHold() {
    const el = holdFillRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.width = "0%";
      void el.offsetWidth;
      el.style.transition = `width ${HOLD_TO_LEAVE_MS}ms linear`;
      el.style.width = "100%";
    }
    holdTimeoutRef.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(onLeave, LEAVE_MESSAGE_MS);
    }, HOLD_TO_LEAVE_MS);
  }

  function cancelHold() {
    clearTimeout(holdTimeoutRef.current);
    const el = holdFillRef.current;
    if (el) {
      el.style.transition = "width 0.2s ease";
      el.style.width = "0%";
    }
  }

  useEffect(() => {
    // Re-sends room:join on every connect, not just the first one, so a
    // dropped/restarted server doesn't leave people stuck outside the room
    // once the connection comes back (socket.io-client reconnects on its
    // own, but it doesn't know about our room concept).
    function handleConnect() {
      setConnected(true);
      socket.emit("room:join", {
        roomId,
        name,
        avatar: getSavedAvatar(),
        bio: getSavedBio(),
        authToken: getToken(),
      });
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleJoined({ members, leaderId, theme: serverTheme }) {
      setMembers(members);
      setLeaderId(leaderId);
      if (serverTheme) setTheme(serverTheme);
      // Applying a theme chosen on the Home/Themes page before creating a
      // brand-new room — only makes sense if we're its leader (i.e. we just
      // created it) and only ever happens once per room.
      const wanted = initialThemeRef.current;
      if (!initialThemeAppliedRef.current && wanted && leaderId === socket.id && serverTheme !== wanted) {
        initialThemeAppliedRef.current = true;
        socket.emit("theme:set", { roomId, theme: wanted });
      }
    }
    function handlePresence({ members, leaderId, theme }) {
      setMembers(members);
      setLeaderId(leaderId);
      if (theme) setTheme(theme);
    }
    function handleRoomFull({ max }) {
      setRoomFull({ max });
    }
    // Genre-matched easter eggs: anyone typing a theme's trigger phrase
    // while that theme is active sets off a visual flourish for the whole
    // room — this rides along on the already-broadcast chat message.
    function handleChatMessage(message) {
      if (message.system) return;
      const egg = THEME_EASTER_EGGS[themeRef.current];
      if (!egg) return;
      if (message.text?.toLowerCase().includes(egg.phrase)) {
        playFlourish(egg.effect);
        showToast(egg.message);
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:joined", handleJoined);
    socket.on("room:presence", handlePresence);
    socket.on("room:full", handleRoomFull);
    socket.on("chat:message", handleChatMessage);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:joined", handleJoined);
      socket.off("room:presence", handlePresence);
      socket.off("room:full", handleRoomFull);
      socket.off("chat:message", handleChatMessage);
      socket.disconnect();
      clearTimeout(toastTimeoutRef.current);
      clearTimeout(flourishTimeoutRef.current);
      clearTimeout(holdTimeoutRef.current);
    };
  }, [roomId, name]);

  // Rejected by the server (server/index.js MAX_ROOM_SIZE) - video call
  // quality degrades badly past this well before cost is a real concern
  // (see LOG.md for the math). Nothing else in the room ever mounts.
  if (roomFull) {
    return (
      <div className="cinema-shell" data-theme="classic">
        <PixelTheaterScenery theme="classic" mode="lobby" />
        <div className="join-screen">
          <h1>CouchCrew</h1>
          <p>
            This room already has {roomFull.max} people in it — that's the cap, since video
            quality falls apart past that anyway.
          </p>
          <button type="button" onClick={onLeave}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cinema-shell" data-theme={theme}>
      <PixelTheaterScenery theme={theme} mode="room" />
      <div className="room-view" data-theme={theme}>
      {flourish && <div className={`flourish flourish-${flourish}`} aria-hidden="true" />}
      {toast && <div className="toast">{toast.text}</div>}
      {leaving && <div className="leave-overlay">Are you sure? It's just getting good...</div>}

      <header>
        <div className="room-header-top">
          <button
            type="button"
            className="hamburger-button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Room settings"
          >
            ☰
          </button>
          <h1 className="marquee-title" onClick={handleMarqueeClick}>
            Room: {roomId}
          </h1>
          <div className="room-header-actions">
            <button type="button" className="secondary" onClick={copyInviteLink}>
              {linkCopied ? "Link copied!" : "Copy invite link"}
            </button>
            <button
              type="button"
              className="secondary leave hold-leave"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
            >
              <span className="hold-fill" ref={holdFillRef} />
              <span className="hold-label">Leave room (hold)</span>
            </button>
          </div>
        </div>

        {creditsVisible && (
          <p className="credits">Directed by Adrian · Henry · John — CouchCrew Pictures</p>
        )}

        {!connected && <p className="reconnecting">Reconnecting...</p>}
      </header>

      <RoomSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        members={members}
        leaderId={leaderId}
        amLeader={amLeader}
        theme={theme}
        onSetTheme={setRoomTheme}
        onTransferLeader={transferLeader}
        onProfileSave={handleProfileSave}
      />

      <div className="room-grid">
        {/* Grouped into one visual frame (see App.css .screen-stack) to read
            as a single screen, closer to the reference mockups, without
            touching WatchPlayer/VideoPanel's own markup — Henry's upcoming
            WebRTC rebuild of VideoPanel can drop in here unchanged. */}
        <div className="screen-stack">
          <WatchPlayer
            roomId={roomId}
            isLeader={amLeader}
            onShareScreen={() => videoPanelRef.current?.shareScreen()}
          />
          <VideoPanel ref={videoPanelRef} roomId={roomId} />
        </div>
      </div>
      <ChatPanel roomId={roomId} onFlourish={playFlourish} onToast={showToast} />
    </div>
    </div>
  );
}
