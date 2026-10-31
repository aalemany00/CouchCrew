import { useState } from "react";
import { generateRoomCode } from "../lib/roomCode";

function getSavedName() {
  try {
    return localStorage.getItem("couchcrew:name") || "";
  } catch {
    return "";
  }
}

// initialRoomId is set when the page was loaded from a shared /r/<code>
// link — in that case we already know the room, so just ask for a name.
export default function JoinScreen({ initialRoomId, onJoin }) {
  const [name, setName] = useState(getSavedName);
  const [roomId, setRoomId] = useState("");

  function join(targetRoomId) {
    // Normalize so "ABC123" and "abc123" are the same room — people will
    // read codes aloud or retype them from memory.
    const normalizedRoomId = targetRoomId.trim().toLowerCase();
    if (!name.trim() || !normalizedRoomId) return;
    onJoin({ name: name.trim(), roomId: normalizedRoomId });
  }

  if (initialRoomId) {
    return (
      <div className="join-screen">
        <h1>CouchCrew</h1>
        <p>Joining room {initialRoomId}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            join(initialRoomId);
          }}
        >
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button type="submit">Join room</button>
        </form>
      </div>
    );
  }

  return (
    <div className="join-screen">
      <h1>CouchCrew</h1>
      <p>Watch together, chat, and talk — from wherever you are.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join(roomId);
        }}
      >
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Room code (from a link a friend sent you)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button type="submit">Join room</button>
      </form>
      <div className="join-divider">or</div>
      <button
        type="button"
        className="secondary"
        onClick={() => join(generateRoomCode())}
      >
        Create a new room
      </button>
    </div>
  );
}
