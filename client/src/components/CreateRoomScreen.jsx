import { useState } from "react";

function getSavedName() {
  try {
    return localStorage.getItem("couchcrew:name") || "";
  } catch {
    return "";
  }
}

// Reached from Home's "Create a Room" (or the Themes gallery's "Select
// Theme") - unlike JoinScreen, the room doesn't exist yet, so this collects
// the room code (optional - left blank, App.jsx auto-generates a
// film-inspired one) alongside the name, instead of asking for the name
// only after a code's already been decided.
export default function CreateRoomScreen({ onCreate, creating }) {
  const [name, setName] = useState(getSavedName);
  const [code, setCode] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    onCreate({ name: name.trim(), code: code.trim() });
  }

  return (
    <div className="join-screen">
      <h1>CouchCrew</h1>
      <p>Creating a room</p>
      <form onSubmit={submit}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={creating}
        />
        <input
          type="text"
          placeholder="Room code (optional - leave blank for a movie-inspired one)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={creating}
        />
        <button type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create Room"}
        </button>
      </form>
    </div>
  );
}
