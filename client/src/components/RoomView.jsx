import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { THEMES, SNACKS, THEME_EASTER_EGGS } from "../lib/theater";
import ChatPanel from "./ChatPanel";
import VideoPanel from "./VideoPanel";
import WatchPlayer from "./WatchPlayer";

const MARQUEE_CLICKS_TO_REVEAL = 5;
const MARQUEE_CLICK_WINDOW_MS = 2000;
const SNACK_CLICKS_TO_POP = 3;
const SNACK_CLICK_WINDOW_MS = 1200;
const HOLD_TO_LEAVE_MS = 3000;
const LEAVE_MESSAGE_MS = 900;

export default function RoomView({ roomId, name, onLeave }) {
  const [members, setMembers] = useState([]);
  const [leaderId, setLeaderId] = useState(null);
  const [theme, setTheme] = useState("classic");
  const [connected, setConnected] = useState(socket.connected);
  const [linkCopied, setLinkCopied] = useState(false);
  const [toast, setToast] = useState(null); // { text }
  const [flourish, setFlourish] = useState(null); // "flicker" | "shake" | "hearts" | "confetti"
  const [creditsVisible, setCreditsVisible] = useState(false);
  const [leaving, setLeaving] = useState(false); // theatrical pause before actually leaving

  const amLeader = connected && leaderId === socket.id;

  const marqueeClicksRef = useRef([]);
  const snackClicksRef = useRef({});
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

  // Easter egg: click the same snack 3 times within 1.2s for a little show.
  function handleSnackClick(snack) {
    const now = Date.now();
    const clicks = (snackClicksRef.current[snack.id] || []).filter(
      (t) => now - t < SNACK_CLICK_WINDOW_MS
    );
    clicks.push(now);
    snackClicksRef.current[snack.id] = clicks;
    if (clicks.length >= SNACK_CLICKS_TO_POP) {
      snackClicksRef.current[snack.id] = [];
      playFlourish(`snack-${snack.id}`);
      showToast(snack.message);
    }
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
      socket.emit("room:join", { roomId, name });
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleJoined({ members, leaderId, theme }) {
      setMembers(members);
      setLeaderId(leaderId);
      if (theme) setTheme(theme);
    }
    function handlePresence({ members, leaderId, theme }) {
      setMembers(members);
      setLeaderId(leaderId);
      if (theme) setTheme(theme);
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
    socket.on("chat:message", handleChatMessage);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:joined", handleJoined);
      socket.off("room:presence", handlePresence);
      socket.off("chat:message", handleChatMessage);
      socket.disconnect();
      clearTimeout(toastTimeoutRef.current);
      clearTimeout(flourishTimeoutRef.current);
      clearTimeout(holdTimeoutRef.current);
    };
  }, [roomId, name]);

  return (
    <div className="room-view" data-theme={theme}>
      {flourish && <div className={`flourish flourish-${flourish}`} aria-hidden="true" />}
      {toast && <div className="toast">{toast.text}</div>}
      {leaving && <div className="leave-overlay">Are you sure? It's just getting good...</div>}

      <header>
        <div className="room-header-top">
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

        {amLeader && (
          <div className="theme-picker">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-chip${t.id === theme ? " active" : ""}`}
                onClick={() => setRoomTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="snack-bar">
          {SNACKS.map((snack) => (
            <button
              key={snack.id}
              type="button"
              className="snack"
              title={snack.label}
              onClick={() => handleSnackClick(snack)}
            >
              {snack.emoji}
            </button>
          ))}
        </div>

        {connected ? (
          <ul className="member-list">
            {members.map((m) => {
              const isLeader = m.id === leaderId;
              return (
                <li key={m.id} className={isLeader ? "leader" : undefined}>
                  {isLeader && <span title="Room leader">👑</span>} {m.name}
                  {amLeader && !isLeader && (
                    <button
                      type="button"
                      className="make-leader"
                      onClick={() => transferLeader(m.id)}
                    >
                      Make leader
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="reconnecting">Reconnecting...</p>
        )}
      </header>
      <div className="room-grid">
        <WatchPlayer roomId={roomId} isLeader={amLeader} />
        <VideoPanel roomId={roomId} />
        <ChatPanel roomId={roomId} />
      </div>
    </div>
  );
}
