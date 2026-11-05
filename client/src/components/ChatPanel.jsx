import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { SNACKS } from "../lib/theater";

const SNACK_CLICKS_TO_POP = 3;
const SNACK_CLICK_WINDOW_MS = 1200;

function formatTime(at) {
  if (!at) return "";
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Job 1 (Rooms, Chat & Realtime Backbone) owns this component. Floats over
// the room instead of sitting as a tall box at the bottom — collapses to a
// small toggle (with an unread badge) and expands into a side panel so it
// doesn't compete with the watch screen for space.
export default function ChatPanel({ roomId, onFlourish, onToast }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const logRef = useRef(null);
  const openRef = useRef(open);
  const snackClicksRef = useRef({});

  useEffect(() => {
    openRef.current = open;
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    // room:joined carries recent history so joining mid-conversation isn't
    // an empty chat panel; chat:message covers everything after that,
    // including the join/leave system messages the server sends.
    function handleRoomJoined({ messages }) {
      setMessages(messages || []);
    }
    function handleMessage(msg) {
      setMessages((prev) => [...prev, msg]);
      if (!openRef.current) setUnread((n) => n + 1);
    }
    socket.on("room:joined", handleRoomJoined);
    socket.on("chat:message", handleMessage);
    return () => {
      socket.off("room:joined", handleRoomJoined);
      socket.off("chat:message", handleMessage);
    };
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit("chat:message", { roomId, text: draft.trim() });
    setDraft("");
  }

  // Easter egg: click the same snack 3 times within 1.2s for a little show.
  // Now a chat thing, not a whole-room header fixture.
  function handleSnackClick(snack) {
    const now = Date.now();
    const clicks = (snackClicksRef.current[snack.id] || []).filter(
      (t) => now - t < SNACK_CLICK_WINDOW_MS
    );
    clicks.push(now);
    snackClicksRef.current[snack.id] = clicks;
    if (clicks.length >= SNACK_CLICKS_TO_POP) {
      snackClicksRef.current[snack.id] = [];
      onFlourish?.(`snack-${snack.id}`);
      onToast?.(snack.message);
    }
  }

  return (
    <>
      <button
        type="button"
        className="chat-float-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        💬
        {!open && unread > 0 && <span className="chat-unread-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      <div className={`chat-float-panel${open ? " open" : ""}`}>
        <div className="chat-panel">
          <div className="chat-panel-header">
            <h2>Chat</h2>
            <button type="button" className="drawer-close" onClick={() => setOpen(false)} aria-label="Collapse chat">
              ✕
            </button>
          </div>

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

          <ul className="chat-log" ref={logRef}>
            {messages.map((m, i) => (
              <li key={m.id || i} className={m.system ? "system" : undefined}>
                {m.system ? (
                  m.text
                ) : (
                  <>
                    <strong>{m.name}:</strong> {m.text}
                    <span className="chat-time">{formatTime(m.at)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={sendMessage}>
            <input
              type="text"
              placeholder="Say something..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </>
  );
}
