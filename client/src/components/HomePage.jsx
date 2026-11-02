import { THEMES } from "../lib/theater";
import { generateRoomCode } from "../lib/roomCode";
import { navigate } from "../lib/router";
import { ScreenBackdrop, PopcornAndReel, SeatsRow } from "./TheaterArt";

export default function HomePage({ pendingTheme, onSelectTheme, onCreate }) {
  function createRoom() {
    onCreate(generateRoomCode(), pendingTheme);
  }

  return (
    <div className="home-page">
      <div className="theater-hero">
        <div className="curtain curtain-left" aria-hidden="true" />
        <div className="curtain curtain-right" aria-hidden="true" />

        <div className="hero-main">
          <div className="hero-screen-wrap">
            <div className="hero-screen">
              {!pendingTheme || pendingTheme === "classic" ? <ScreenBackdrop /> : <div className="genre-screen-backdrop" aria-hidden="true" />}
              <div className="hero-screen-content">
                <h1 className="hero-logo">CouchCrew</h1>
                <span className="hero-logo-underline" aria-hidden="true" />
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
            <PopcornAndReel />
          </div>
        </div>
      </div>

      <SeatsRow />

      <section className="theme-gallery">
        <h2 className="divider-heading">
          <span>Choose a theme</span>
        </h2>
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
