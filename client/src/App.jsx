import { useState } from "react";
import JoinScreen from "./components/JoinScreen";
import RoomView from "./components/RoomView";
import { getRoomIdFromPath, setRoomPath, clearRoomPath } from "./lib/roomPath";
import "./App.css";

function getResumedSession(urlRoomId) {
  if (!urlRoomId) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem("couchcrew:session") || "null");
    return saved && saved.roomId === urlRoomId ? saved : null;
  } catch {
    return null;
  }
}

function App() {
  const [urlRoomId, setUrlRoomId] = useState(getRoomIdFromPath);
  // If this is a refresh of a room we were already in, skip straight back
  // into it instead of showing the join screen again.
  const [session, setSession] = useState(() => getResumedSession(urlRoomId));

  function handleJoin({ name, roomId }) {
    const next = { name, roomId };
    setSession(next);
    setRoomPath(roomId);
    try {
      sessionStorage.setItem("couchcrew:session", JSON.stringify(next));
      localStorage.setItem("couchcrew:name", name);
    } catch {
      // Storage can be unavailable (private browsing, etc.) — the app still
      // works, you just won't get the refresh/rejoin convenience.
    }
  }

  function handleLeave() {
    setSession(null);
    setUrlRoomId(null);
    clearRoomPath();
    try {
      sessionStorage.removeItem("couchcrew:session");
    } catch {
      // ignore
    }
  }

  if (!session) {
    return <JoinScreen initialRoomId={urlRoomId} onJoin={handleJoin} />;
  }

  return <RoomView roomId={session.roomId} name={session.name} onLeave={handleLeave} />;
}

export default App;
