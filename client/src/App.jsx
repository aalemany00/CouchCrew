import { useEffect, useState } from "react";
import JoinScreen from "./components/JoinScreen";
import RoomView from "./components/RoomView";
import NavBar from "./components/NavBar";
import HomePage from "./components/HomePage";
import ThemesPage from "./components/ThemesPage";
import SettingsPage from "./components/SettingsPage";
import HelpPage from "./components/HelpPage";
import { getRoute, navigate, setRoomPath } from "./lib/router";
import { rememberRecentRoom } from "./lib/recentRooms";
import { claimRoomCode } from "./lib/roomApi";
import "./App.css";
import "./immersive-theater.css";
import PixelTheaterScenery from "./components/PixelTheaterScenery";

function getResumedSession(roomId) {
  if (!roomId) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem("couchcrew:session") || "null");
    return saved && saved.roomId === roomId ? saved : null;
  } catch {
    return null;
  }
}

function App() {
  const [route, setRoute] = useState(getRoute);
  const [session, setSession] = useState(() =>
    route.page === "room" ? getResumedSession(route.roomId) : null
  );
  const [pendingTheme, setPendingTheme] = useState(null);
  const [creatingRoom, setCreatingRoom] = useState(false);

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

  // Create a brand-new room (from Home's "Create a Room" — optionally with a
  // custom code — or the Themes gallery's "Select Theme") and navigate
  // straight to it. `desiredCode` is sanitized and, if already taken by an
  // active room, auto-suffixed ("movienight" -> "movienight-2") rather than
  // silently dropping the creator into someone else's room. The actual join
  // (collecting a name) happens via JoinScreen once we land on /r/<roomId>.
  async function createRoom(desiredCode, theme) {
    setCreatingRoom(true);
    try {
      const roomId = await claimRoomCode(desiredCode);
      setPendingTheme(theme || null);
      setRoomPath(roomId);
      setRoute({ page: "room", roomId });
    } finally {
      setCreatingRoom(false);
    }
  }

  if (route.page === "room") {
    if (!session || session.roomId !== route.roomId) {
      return (
        <div className="cinema-shell" data-theme={pendingTheme || "classic"}>
          <PixelTheaterScenery theme={pendingTheme || "classic"} mode="lobby" />
          <JoinScreen initialRoomId={route.roomId} onJoin={handleJoin} />
        </div>
      );
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
    <div className="cinema-shell" data-theme={pendingTheme || "classic"}>
      <PixelTheaterScenery theme={pendingTheme || "classic"} mode="lobby" />
      <NavBar currentPage={route.page} />
      {route.page === "themes" && <ThemesPage onCreate={createRoom} />}
      {route.page === "settings" && <SettingsPage />}
      {route.page === "help" && <HelpPage />}
      {route.page === "home" && <HomePage onCreate={createRoom} creating={creatingRoom} />}
    </div>
  );
}

export default App;
