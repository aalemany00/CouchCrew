const ROOM_SIZE_CAP = 5;

export default function HelpPage() {
  return (
    <div className="page help-page">
      <h1>Help &amp; FAQ</h1>

      <h2>Why is there a {ROOM_SIZE_CAP}-person room limit?</h2>
      <p className="room-tag">
        Two reasons, and the first one matters more: past {ROOM_SIZE_CAP} people in a video
        call, everyone's camera starts to stutter and look rough — that's just how many live
        video feeds a browser (and most home connections) can juggle at once, regardless of
        our code.
      </p>
      <p className="room-tag">
        The second reason is cost, though it's a distant second. When two people are on
        different networks (different WiFi, or WiFi vs. mobile data), their call routes
        through a relay server (Cloudflare TURN) instead of connecting directly. That relay
        has a free allowance of 1,000 GB of traffic per month, then costs a fraction of a
        cent per GB past that. Based on typical video-call bandwidth, a {ROOM_SIZE_CAP}-person
        room would need to run non-stop for roughly two weeks straight in a month to use up
        that free allowance — and a 2-person room would take closer to 40 days straight,
        which isn't possible in a 30-day month. In practice this almost certainly never
        costs anything; the room limit exists for the video-quality reason, not because
        we're worried about a bill.
      </p>

      <h2>A room says it's full — what do I do?</h2>
      <p className="room-tag">
        Wait for a spot to open up, or create a new room instead — there's no limit on how
        many rooms can exist at once, just how many people are in one room together.
      </p>

      <h2>Which streaming services work here?</h2>
      <p className="room-tag">
        YouTube (synced play/pause/seek) and live Twitch or Kick channels work directly in
        the room. Netflix, Hulu, Prime Video, Disney+, and similar services can't be embedded
        here at all — they're locked to their own apps by design (DRM and licensing), not
        something we can work around. Use the Video &amp; Screen Share panel to share your
        screen instead if you want to watch one of those together.
      </p>

      <h2>My video call won't connect to someone</h2>
      <p className="room-tag">
        This usually means you're on different networks and the relay isn't available yet
        (or failed) — try again in a minute. If it keeps happening, it's worth flagging to
        the team rather than assuming it's something you did wrong.
      </p>
    </div>
  );
}
