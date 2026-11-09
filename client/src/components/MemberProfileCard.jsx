// A small "who is this" card: tapping a name in the room settings drawer's
// People list, or an avatar/name in chat, opens this instead of silently
// doing nothing. Shared so both spots render a profile the same way.
//
// isDeveloper isn't shown as a separate badge here - the glowing name/
// avatar (see .dev-name/.dev-avatar in App.css) already makes it obvious
// everywhere the name appears, with no click needed, so this card just
// keeps that same look rather than adding another "you found it" tag.
export default function MemberProfileCard({ name, avatar, bio, isDeveloper, onClose }) {
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="member-profile-card" role="dialog" aria-label={`${name}'s profile`}>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <span className={`avatar-preview member-profile-avatar${isDeveloper ? " dev-avatar" : ""}`} aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : (name?.trim()[0] || "?").toUpperCase()}
        </span>
        <h3 className={isDeveloper ? "dev-name" : undefined}>{name}</h3>
        <p className="member-profile-bio">{bio?.trim() || "No bio yet."}</p>
      </div>
    </>
  );
}
