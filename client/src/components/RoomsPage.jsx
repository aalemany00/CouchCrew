import { useState } from "react";
import { navigate } from "../lib/router";

function getRecentRooms() {
  try {
    return JSON.parse(localStorage.getItem("couchcrew:recentRooms") || "[]");
  } catch {
    return [];
  }
}

export default function RoomsPage() {
  const [code, setCode] = useState("");
  const recentRooms = getRecentRooms();

  function join(e) {
    e.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    navigate(`/r/${trimmed}`);
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
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
