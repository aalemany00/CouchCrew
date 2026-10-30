import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import ChatPanel from "./ChatPanel";
import VideoPanel from "./VideoPanel";
import WatchPlayer from "./WatchPlayer";

export default function RoomView({ roomId, name }) {
  const [members, setMembers] = useState([]);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    // Re-sends room:join on every connect, not just the first one, so a
    // dropped/restarted server doesn't leave people stuck outside the room
    // once the connection comes back (socket.io-client reconnects on its
    // own, but it doesn't know about our room concept).
    function handleConnect() {
      setConnected(true);
      socket.emit("room:join", { roomId, name });
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleJoined({ members }) {
      setMembers(members);
    }
    function handlePresence({ members }) {
      setMembers(members);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:joined", handleJoined);
    socket.on("room:presence", handlePresence);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:joined", handleJoined);
      socket.off("room:presence", handlePresence);
      socket.disconnect();
    };
  }, [roomId, name]);

  return (
    <div className="room-view">
      <header>
        <h1>Room: {roomId}</h1>
        {connected ? (
          <p>{members.length} watching: {members.map((m) => m.name).join(", ")}</p>
        ) : (
          <p className="reconnecting">Reconnecting...</p>
        )}
      </header>
      <div className="room-grid">
        <WatchPlayer roomId={roomId} />
        <VideoPanel roomId={roomId} />
        <ChatPanel roomId={roomId} />
      </div>
    </div>
  );
}
