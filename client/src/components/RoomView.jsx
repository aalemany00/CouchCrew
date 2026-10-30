import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import ChatPanel from "./ChatPanel";
import VideoPanel from "./VideoPanel";
import WatchPlayer from "./WatchPlayer";

export default function RoomView({ roomId, name }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    socket.connect();
    socket.emit("room:join", { roomId, name });

    function handleJoined({ members }) {
      setMembers(members);
    }
    function handlePresence({ members }) {
      setMembers(members);
    }

    socket.on("room:joined", handleJoined);
    socket.on("room:presence", handlePresence);

    return () => {
      socket.off("room:joined", handleJoined);
      socket.off("room:presence", handlePresence);
      socket.disconnect();
    };
  }, [roomId, name]);

  return (
    <div className="room-view">
      <header>
        <h1>Room: {roomId}</h1>
        <p>{members.length} watching: {members.map((m) => m.name).join(", ")}</p>
      </header>
      <div className="room-grid">
        <WatchPlayer roomId={roomId} />
        <VideoPanel roomId={roomId} />
        <ChatPanel roomId={roomId} />
      </div>
    </div>
  );
}
