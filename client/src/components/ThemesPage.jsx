import { THEMES } from "../lib/theater";
import { navigate } from "../lib/router";
import PixelTheaterScenery from "./PixelTheaterScenery";

// Browsing themes here just changes which one is selected (previewed on
// this page's own background) - it does NOT create or join a room on its
// own. Creating with the selected theme (or none) is a separate, explicit
// step via the "Create a Room" button below the gallery.
export default function ThemesPage({ pendingTheme, onSelectTheme }) {
  return (
    <div className="page themes-page">
      <h1>Themes</h1>
      <p className="room-tag">
        Pick a mood - it's saved for whenever you create a room, nothing happens until then.
      </p>
      <div className="poster-grid">
        {THEMES.map((t) => (
          <div key={t.id} className="poster-card" data-theme={t.id}>
            <span className="pixel-poster-art"><PixelTheaterScenery theme={t.id} mode="poster" /></span>
            <span className="poster-label">{t.label}</span>
            <span className="poster-tagline">{t.tagline}</span>
            <button
              type="button"
              className={`ticket-button small${pendingTheme === t.id ? " active" : ""}`}
              onClick={() => onSelectTheme(pendingTheme === t.id ? null : t.id)}
            >
              {pendingTheme === t.id ? "Selected ✓" : "Select Theme"}
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="ticket-button" onClick={() => navigate("/create")}>
        ★ Create a Room ★
      </button>
    </div>
  );
}
