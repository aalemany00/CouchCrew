import { useState } from "react";

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;
    onJoin({ name: name.trim(), roomId: roomId.trim() });
  }

  return (
    <div className="join-screen">
      <h1>CouchCrew</h1>
      <p>Watch together, chat, and talk — from wherever you are.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Room code (make one up to create a room)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button type="submit">Join room</button>
      </form>
    </div>
  );
}
