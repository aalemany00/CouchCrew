import { THEMES } from "../lib/theater";
import PixelTheaterScenery from "./PixelTheaterScenery";

// A dedicated gallery to browse every theme and jump straight into a new
// room with it already set — the Home page's picker is for "pick, then
// create"; this is "pick and go."
export default function ThemesPage({ onCreate }) {
  return (
    <div className="page themes-page">
      <h1>Themes</h1>
      <p className="room-tag">Pick a mood and jump straight into a new room with it set.</p>
      <div className="poster-grid">
        {THEMES.map((t) => (
          <div key={t.id} className="poster-card" data-theme={t.id}>
            <span className="pixel-poster-art"><PixelTheaterScenery theme={t.id} mode="poster" /></span>
            <span className="poster-label">{t.label}</span>
            <span className="poster-tagline">{t.tagline}</span>
            <button
              type="button"
              className="ticket-button small"
              onClick={() => onCreate("", t.id)}
            >
              Select Theme
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
