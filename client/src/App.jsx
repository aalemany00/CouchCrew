import { useEffect, useState } from "react";
import JoinScreen from "./components/JoinScreen";
import RoomView from "./components/RoomView";
import NavBar from "./components/NavBar";
import HomePage from "./components/HomePage";
import RoomsPage from "./components/RoomsPage";
import ThemesPage from "./components/ThemesPage";
import SettingsPage from "./components/SettingsPage";
import { getRoute, navigate, setRoomPath } from "./lib/router";
import "./App.css";

const MAX_RECENT_ROOMS = 5;

function getResumedSession(roomId) {
  if (!roomId) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem("couchcrew:session") || "null");
    return saved && saved.roomId === roomId ? saved : null;
  } catch {
    return null;
  }
}

function rememberRecentRoom(roomId) {
  try {
    const existing = JSON.parse(localStorage.getItem("couchcrew:recentRooms") || "[]");
    const next = [roomId, ...existing.filter((id) => id !== roomId)].slice(0, MAX_RECENT_ROOMS);
    localStorage.setItem("couchcrew:recentRooms", JSON.stringify(next));
  } catch {
    // ignore — just a convenience list
  }
}

function App() {
  const [route, setRoute] = useState(getRoute);
  const [session, setSession] = useState(() =>
    route.page === "room" ? getResumedSession(route.roomId) : null
  );
  const [pendingTheme, setPendingTheme] = useState(null);

  useEffect(() => {
    function handlePopState() {
      setRoute(getRoute());
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleJoin({ name, roomId }) {
    const next = { name, roomId };
    setSession(next);
    rememberRecentRoom(roomId);
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
    setPendingTheme(null);
    navigate("/");
    setRoute(getRoute());
  }

  // Create a brand-new room (from Home's "Create a Room" or the Themes
  // gallery's "Select Theme") and navigate straight to it. The actual join
  // (collecting a name) happens via JoinScreen once we land on /r/<roomId>.
  function createRoom(roomId, theme) {
    setPendingTheme(theme || null);
    setRoomPath(roomId);
    setRoute({ page: "room", roomId });
  }

  if (route.page === "room") {
    if (!session || session.roomId !== route.roomId) {
      return <JoinScreen initialRoomId={route.roomId} onJoin={handleJoin} />;
    }
    return (
      <RoomView
        roomId={session.roomId}
        name={session.name}
        initialTheme={pendingTheme}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <>
      <NavBar currentPage={route.page} />
      {route.page === "rooms" && <RoomsPage />}
      {route.page === "themes" && <ThemesPage onCreate={createRoom} />}
      {route.page === "settings" && <SettingsPage />}
      {route.page === "home" && (
        <HomePage
          pendingTheme={pendingTheme}
          onSelectTheme={setPendingTheme}
          onCreate={createRoom}
        />
      )}
    </>
  );
}

export default App;
