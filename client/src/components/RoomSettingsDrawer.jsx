import { useState } from "react";
import { THEMES } from "../lib/theater";
import ProfileForm from "./ProfileForm";
import MediaDeviceSettings from "./MediaDeviceSettings";
import MemberProfileCard from "./MemberProfileCard";

// The room's ☰ menu: people count and video/mic/profile settings are open
// to everyone; changing the theme or who leads the room is leader-only —
// everything else in here is a personal preference, not a room-wide one.
export default function RoomSettingsDrawer({
  open,
  onClose,
  members,
  leaderId,
  amLeader,
  theme,
  roomId,
  title,
  onRename,
  onCopyLink,
  linkCopied,
  onSetTheme,
  onTransferLeader,
  onProfileSave,
}) {
  const [viewingMember, setViewingMember] = useState(null);

  // What the leader is typing for the room name; null means "show the saved
  // name" (so a rename from elsewhere still shows up).
  const [draft, setDraft] = useState(null);
  if (!open) return null;
  const nameValue = draft ?? title;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="room-settings-drawer" role="dialog" aria-label="Room settings">
        <div className="drawer-header">
          <h2>Room Settings</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <section className="drawer-section">
          <h3>People</h3>
          <p className="room-tag">
            {members.length} {members.length === 1 ? "person" : "people"} in this room
          </p>
          <ul className="member-list">
            {members.map((m) => (
              <li key={m.id} className={m.id === leaderId ? "leader" : undefined}>
                {m.id === leaderId && <span title="Room leader">👑</span>}{" "}
                <button
                  type="button"
                  className={`member-name-button${m.isDeveloper ? " dev-name" : ""}`}
                  onClick={() => setViewingMember(m)}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="drawer-section">
          <h3>Invite</h3>
          <p className="room-tag">
            Room code: <strong>{roomId}</strong>
          </p>
          <button type="button" className="secondary" onClick={onCopyLink}>
            {linkCopied ? "Link copied!" : "Copy invite link"}
          </button>
        </section>

        {amLeader && (
          <section className="drawer-section">
            <h3>Room name (leader only)</h3>
            <form
              className="room-name-form"
              onSubmit={(e) => {
                e.preventDefault();
                onRename(nameValue);
                setDraft(null);
              }}
            >
              <input
                type="text"
                value={nameValue}
                maxLength={40}
                placeholder="e.g. Friday movie night"
                aria-label="Room name"
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit">Save</button>
            </form>
            <p className="room-tag">
              Shown at the top of the room for everyone. The link and code stay the same. Leave
              it empty to show the code.
            </p>
          </section>
        )}

        <section className="drawer-section">
          <h3>Video &amp; Mic</h3>
          <MediaDeviceSettings />
        </section>

        <section className="drawer-section">
          <h3>Profile</h3>
          <ProfileForm onSave={onProfileSave} />
        </section>

        {amLeader && (
          <section className="drawer-section">
            <h3>Theme (leader only)</h3>
            <div className="theme-picker">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-chip${t.id === theme ? " active" : ""}`}
                  onClick={() => onSetTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {amLeader && members.length > 1 && (
          <section className="drawer-section">
            <h3>Leader (leader only)</h3>
            <ul className="member-list">
              {members
                .filter((m) => m.id !== leaderId)
                .map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`member-name-button${m.isDeveloper ? " dev-name" : ""}`}
                      onClick={() => setViewingMember(m)}
                    >
                      {m.name}
                    </button>
                    <button type="button" className="make-leader" onClick={() => onTransferLeader(m.id)}>
                      Make leader
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </aside>

      {viewingMember && (
        <MemberProfileCard
          name={viewingMember.name}
          avatar={viewingMember.avatar}
          bio={viewingMember.bio}
          isDeveloper={viewingMember.isDeveloper}
          onClose={() => setViewingMember(null)}
        />
      )}
    </>
  );
}
