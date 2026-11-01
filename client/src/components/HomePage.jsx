import { THEMES } from "../lib/theater";
import { generateRoomCode } from "../lib/roomCode";
import { navigate } from "../lib/router";

export default function HomePage({ pendingTheme, onSelectTheme, onCreate }) {
  function createRoom() {
    onCreate(generateRoomCode(), pendingTheme);
  }

  return (
    <div className="home-page">
      <div className="theater-hero">
        <div className="curtain curtain-left" aria-hidden="true" />
        <div className="curtain curtain-right" aria-hidden="true" />
        <div className="hero-decor" aria-hidden="true">
          🍿
          <span className="film-reel">🎞️</span>
        </div>
        <div className="hero-screen">
          <h1 className="hero-logo">CouchCrew</h1>
          <p className="hero-tagline">WATCH TOGETHER. ANYWHERE.</p>
          <button type="button" className="ticket-button" onClick={createRoom}>
            ★ Create a Room ★
          </button>
          <div className="join-divider">or</div>
          <button type="button" className="secondary" onClick={() => navigate("/rooms")}>
            Join with a code
          </button>
        </div>
      </div>

      <section className="theme-gallery">
        <h2>Choose a theme</h2>
        <p className="room-tag">
          Pick the mood for your room — you can always change it once you're in.
        </p>
        <div className="poster-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`poster-card${pendingTheme === t.id ? " active" : ""}`}
              data-theme={t.id}
              onClick={() => onSelectTheme(pendingTheme === t.id ? null : t.id)}
            >
              <span className="poster-icon">{t.icon}</span>
              <span className="poster-label">{t.label}</span>
              <span className="poster-tagline">{t.tagline}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
