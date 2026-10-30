// Job 3 (Synced Watch Party Playback) owns this component.
// Plan: embed the YouTube IFrame Player API here, and relay play/pause/seek
// through socket "sync:event" so everyone in the room stays in sync.
// If a viable cross-service sync approach is found during the research spike,
// it plugs in alongside this; otherwise non-YouTube sources fall back to
// VideoPanel's screen share.
export default function WatchPlayer({ roomId }) {
  return (
    <div className="watch-player placeholder">
      <h2>Watch Together</h2>
      <p>Synced YouTube player goes here (Job 3).</p>
      <p className="room-tag">Room: {roomId}</p>
    </div>
  );
}
