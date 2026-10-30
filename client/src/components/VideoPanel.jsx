// Job 2 (Audio/Video/Screen Share) owns this component.
// Plan: integrate Daily.co here (@daily-co/daily-react) for mic/cam tiles and
// a screen-share button. This placeholder exists so the room layout is real
// before that integration lands.
export default function VideoPanel({ roomId }) {
  return (
    <div className="video-panel placeholder">
      <h2>Video &amp; Screen Share</h2>
      <p>Mic/camera tiles and screen share go here (Job 2 — Daily.co).</p>
      <p className="room-tag">Room: {roomId}</p>
    </div>
  );
}
