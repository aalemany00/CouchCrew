import { rememberTipsDismissed } from "../lib/tips";

// First-visit "what do I do first" tips for a room. Dismissal is remembered
// per browser; the ? button in the room header brings the tips back.
export default function RoomTips({ amLeader, onClose }) {
  return (
    <aside className="room-tips" aria-label="How this room works">
      <h2>New here? Three things to try</h2>
      <ol>
        <li>
          <strong>Invite someone:</strong> press &ldquo;Copy invite link&rdquo; (top right) and send
          it. Anyone with the link can join.
        </li>
        <li>
          <strong>Talk and see each other:</strong> press &ldquo;Join call&rdquo; in the video box.
          Mic and camera are optional, and you can share your screen from there too.
        </li>
        <li>
          <strong>Pick something to watch:</strong>{" "}
          {amLeader
            ? "you're the room leader (👑), so paste a YouTube link or search in the Watch Together box and everyone's player follows yours."
            : "the room leader (👑) chooses what plays and everyone's player follows. Ask them to hand it over from ☰ Room Settings if you want to pick."}
        </li>
      </ol>
      <p className="room-tag">☰ at the top left has your mic, camera, name and the room theme.</p>
      <button
        type="button"
        onClick={() => {
          rememberTipsDismissed();
          onClose();
        }}
      >
        Got it
      </button>
    </aside>
  );
}
