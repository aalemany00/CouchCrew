import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

// Job 1 (Rooms, Chat & Realtime Backbone) owns this component.
export default function ChatPanel({ roomId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    function handleMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }
    socket.on("chat:message", handleMessage);
    return () => socket.off("chat:message", handleMessage);
  }, []);

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit("chat:message", { roomId, text: draft.trim() });
    setDraft("");
  }

  return (
    <div className="chat-panel">
      <h2>Chat</h2>
      <ul className="chat-log">
        {messages.map((m, i) => (
          <li key={i}>
            <strong>{m.name}:</strong> {m.text}
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
