import { useEffect, useState } from "react";
import JoinScreen from "./components/JoinScreen";
import CreateRoomScreen from "./components/CreateRoomScreen";
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

  function rememberSession(next) {
    setSession(next);
    rememberRecentRoom(next.roomId);
    try {
      sessionStorage.setItem("couchcrew:session", JSON.stringify(next));
      localStorage.setItem("couchcrew:name", next.name);
    } catch {
      // Storage can be unavailable (private browsing, etc.) — the app still
      // works, you just won't get the refresh/rejoin convenience.
    }
  }

  // Joining a room someone else already created (a shared link, or Home's
  // "Join with a code") - the room id is fixed, JoinScreen only asks for a
  // name.
  function handleJoin({ name, roomId }) {
    rememberSession({ name, roomId });
  }

  // Creating a brand-new room (Home's "Create a Room", or the Themes
  // gallery's "Select Theme", which sets pendingTheme first) - CreateRoomScreen
  // collects name + an optional room code together, unlike joining. The code
  // is sanitized and, if already taken by an active room, auto-suffixed
  // ("inception" -> "inception-2") rather than silently dropping the
  // creator into someone else's room; left blank, it's a movie-inspired
  // generated one instead of random letters/numbers.
  async function handleCreateRoom({ name, code }) {
    setCreatingRoom(true);
    try {
      const roomId = await claimRoomCode(code);
      setRoomPath(roomId);
      setRoute({ page: "room", roomId });
      rememberSession({ name, roomId });
    } finally {
      setCreatingRoom(false);
    }
  }

  function handleLeave() {
    setSession(null);
    setPendingTheme(null);
    navigate("/");
    setRoute(getRoute());
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

  if (route.page === "create") {
    return (
      <div className="cinema-shell" data-theme={pendingTheme || "classic"}>
        <PixelTheaterScenery theme={pendingTheme || "classic"} mode="lobby" />
        <CreateRoomScreen onCreate={handleCreateRoom} creating={creatingRoom} />
      </div>
    );
  }

  return (
    <div className="cinema-shell" data-theme={pendingTheme || "classic"}>
      <PixelTheaterScenery theme={pendingTheme || "classic"} mode="lobby" />
      <NavBar currentPage={route.page} />
      {route.page === "themes" && <ThemesPage onSelectTheme={setPendingTheme} />}
      {route.page === "settings" && <SettingsPage />}
      {route.page === "help" && <HelpPage />}
      {route.page === "home" && <HomePage />}
    </div>
  );
}

export default App;
