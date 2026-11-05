import { useState } from "react";
import { navigate } from "../lib/router";
import { getRecentRooms, removeRecentRoom } from "../lib/recentRooms";
import ProfileForm from "./ProfileForm";

export default function SettingsPage() {
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentRooms, setRecentRooms] = useState(getRecentRooms);

  function forget(roomId) {
    removeRecentRoom(roomId);
    setRecentRooms(getRecentRooms());
  }

  return (
    <div className="page settings-page">
      <h1>Settings</h1>

      <section className="collapsible-section">
        <button
          type="button"
          className="collapsible-toggle"
          onClick={() => setRecentOpen((v) => !v)}
          aria-expanded={recentOpen}
        >
          <span>Recent rooms {recentRooms.length > 0 && `(${recentRooms.length})`}</span>
          <span aria-hidden="true">{recentOpen ? "▲" : "▼"}</span>
        </button>
        {recentOpen && (
          <div className="collapsible-body">
            {recentRooms.length === 0 ? (
              <p className="room-tag">No rooms yet — join or create one to see it here.</p>
            ) : (
              <ul className="recent-rooms">
                {recentRooms.map((roomId) => (
                  <li key={roomId}>
                    <button type="button" className="secondary" onClick={() => navigate(`/r/${roomId}`)}>
                      {roomId}
                    </button>
                    <button
                      type="button"
                      className="recent-room-remove"
                      title={`Remove ${roomId} from recent rooms`}
                      aria-label={`Remove ${roomId} from recent rooms`}
                      onClick={() => forget(roomId)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <ProfileForm />
    </div>
  );
}
