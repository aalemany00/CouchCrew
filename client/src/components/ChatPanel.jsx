import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";

// Job 1 (Rooms, Chat & Realtime Backbone) owns this component.
export default function ChatPanel({ roomId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const logRef = useRef(null);

  useEffect(() => {
    // room:joined carries recent history so joining mid-conversation isn't
    // an empty chat panel; chat:message covers everything after that,
    // including the join/leave system messages the server sends.
    function handleRoomJoined({ messages }) {
      setMessages(messages || []);
    }
    function handleMessage(msg) {
      setMessages((prev) => [...prev, msg]);
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
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit("chat:message", { roomId, text: draft.trim() });
    setDraft("");
  }

  return (
    <div className="chat-panel">
      <h2>Chat</h2>
      <ul className="chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <li key={m.id || i} className={m.system ? "system" : undefined}>
            {m.system ? m.text : (
              <>
                <strong>{m.name}:</strong> {m.text}
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
  );
}
