import { useState } from "react";
import { navigate } from "../lib/router";
import { getRecentRooms, removeRecentRoom } from "../lib/recentRooms";

export default function RoomsPage() {
  const [code, setCode] = useState("");
  const [recentRooms, setRecentRooms] = useState(getRecentRooms);

  function join(e) {
    e.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    navigate(`/r/${trimmed}`);
  }

  function forget(roomId) {
    removeRecentRoom(roomId);
    setRecentRooms(getRecentRooms());
  }

  return (
    <div className="page rooms-page">
      <h1>Join a Room</h1>
      <form className="join-code-form" onSubmit={join}>
        <input
          type="text"
          placeholder="Room code (from a link a friend sent you)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit">Join</button>
      </form>

      {recentRooms.length > 0 && (
        <>
          <h2>Recent rooms</h2>
          <ul className="recent-rooms">
            {recentRooms.map((roomId) => (
              <li key={roomId}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigate(`/r/${roomId}`)}
                >
                  {roomId}
                </button>
                <button
                  type="button"
                  className="recent-room-remove"
                  title={`Remove ${roomId} from recent rooms`}
                  aria-label={`Remove ${roomId} from recent rooms`}
                  onClick={() => forget(roomId)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
