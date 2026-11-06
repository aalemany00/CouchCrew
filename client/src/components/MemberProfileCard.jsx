// A small "who is this" card: tapping a name in the room settings drawer's
// People list, or an avatar/name in chat, opens this instead of silently
// doing nothing. Shared so both spots render a profile the same way.
export default function MemberProfileCard({ name, avatar, bio, isDeveloper, onClose }) {
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="member-profile-card" role="dialog" aria-label={`${name}'s profile`}>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <span className="avatar-preview member-profile-avatar" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : (name?.trim()[0] || "?").toUpperCase()}
        </span>
        <h3>{name}</h3>
        {isDeveloper && <p className="dev-badge dev-badge-large">🛠️ Built this app</p>}
        <p className="member-profile-bio">{bio?.trim() || "No bio yet."}</p>
      </div>
    </>
  );
}
