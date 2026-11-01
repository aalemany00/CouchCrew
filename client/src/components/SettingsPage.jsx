import { useState } from "react";

function getSavedName() {
  try {
    return localStorage.getItem("couchcrew:name") || "";
  } catch {
    return "";
  }
}

export default function SettingsPage() {
  const [name, setName] = useState(getSavedName);
  const [saved, setSaved] = useState(false);

  function save(e) {
    e.preventDefault();
    try {
      localStorage.setItem("couchcrew:name", name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Storage can be unavailable (private browsing, etc.) — nothing to
      // persist, but the form still works for the current session.
    }
  }

  return (
    <div className="page settings-page">
      <h1>Settings</h1>
      <form onSubmit={save}>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <button type="submit">{saved ? "Saved!" : "Save"}</button>
      </form>
      <h2>About</h2>
      <p className="room-tag">
        CouchCrew — watch movies and shows together with people who aren't in
        the room with you. Built for TCSS 490, Artifact 4.
      </p>
    </div>
  );
}
