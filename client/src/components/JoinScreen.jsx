import { useState } from "react";

function getSavedName() {
  try {
    return localStorage.getItem("couchcrew:name") || "";
  } catch {
    return "";
  }
}

// Reached only via a /r/<roomId> URL (a shared link, or Home/Rooms/Themes
// navigating here after generating/entering a code) — the room id is
// already known, so this just asks for a name.
export default function JoinScreen({ initialRoomId, onJoin }) {
  const [name, setName] = useState(getSavedName);

  function join(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin({ name: name.trim(), roomId: initialRoomId });
  }

  return (
    <div className="join-screen">
      <h1>CouchCrew</h1>
      <p>Joining room {initialRoomId}</p>
      <form onSubmit={join}>
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
