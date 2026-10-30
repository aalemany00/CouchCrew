import { useState } from "react";
import JoinScreen from "./components/JoinScreen";
import RoomView from "./components/RoomView";
import "./App.css";

function App() {
  const [session, setSession] = useState(null); // { name, roomId }

  if (!session) {
    return <JoinScreen onJoin={setSession} />;
  }

  return <RoomView roomId={session.roomId} name={session.name} />;
}

export default App;
