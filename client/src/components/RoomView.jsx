import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import ChatPanel from "./ChatPanel";
import VideoPanel from "./VideoPanel";
import WatchPlayer from "./WatchPlayer";

export default function RoomView({ roomId, name, onLeave }) {
  const [members, setMembers] = useState([]);
  const [leaderId, setLeaderId] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [linkCopied, setLinkCopied] = useState(false);

  const amLeader = connected && leaderId === socket.id;

  async function copyInviteLink() {
    const url = `${window.location.origin}/r/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this link to invite someone:", url);
    }
  }

  function transferLeader(toSocketId) {
    socket.emit("leader:transfer", { roomId, toSocketId });
  }

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
    function handleJoined({ members, leaderId }) {
      setMembers(members);
      setLeaderId(leaderId);
    }
    function handlePresence({ members, leaderId }) {
      setMembers(members);
      setLeaderId(leaderId);
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
        <div className="room-header-top">
          <h1>Room: {roomId}</h1>
          <div className="room-header-actions">
            <button type="button" className="secondary" onClick={copyInviteLink}>
              {linkCopied ? "Link copied!" : "Copy invite link"}
            </button>
            <button type="button" className="secondary leave" onClick={onLeave}>
              Leave room
            </button>
          </div>
        </div>
        {connected ? (
          <ul className="member-list">
            {members.map((m) => {
              const isLeader = m.id === leaderId;
              return (
                <li key={m.id} className={isLeader ? "leader" : undefined}>
                  {isLeader && <span title="Room leader">👑</span>} {m.name}
                  {amLeader && !isLeader && (
                    <button
                      type="button"
                      className="make-leader"
                      onClick={() => transferLeader(m.id)}
                    >
                      Make leader
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="reconnecting">Reconnecting...</p>
        )}
      </header>
      <div className="room-grid">
        <WatchPlayer roomId={roomId} isLeader={amLeader} />
        <VideoPanel roomId={roomId} />
        <ChatPanel roomId={roomId} />
      </div>
    </div>
  );
}
