import { THEMES } from "../lib/theater";
import { navigate } from "../lib/router";
import PixelTheaterScenery from "./PixelTheaterScenery";

// A gallery to browse every theme and jump straight into creating a new
// room with it already set - "Select Theme" carries the choice to the
// Create screen (name + optional room code), same as Home's own
// "Create a Room" button, just with a theme pre-picked.
export default function ThemesPage({ onSelectTheme }) {
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
              onClick={() => {
                onSelectTheme(t.id);
                navigate("/create");
              }}
            >
              Select Theme
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
