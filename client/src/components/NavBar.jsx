import { navigate } from "../lib/router";

const NAV_LINKS = [
  { page: "home", path: "/", label: "Home" },
  { page: "rooms", path: "/rooms", label: "Rooms" },
  { page: "themes", path: "/themes", label: "Themes" },
  { page: "settings", path: "/settings", label: "Settings" },
];

export default function NavBar({ currentPage }) {
  return (
    <>
      <nav className="nav-bar">
        <button type="button" className="nav-logo" onClick={() => navigate("/")}>
          CouchCrew
        </button>
        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <button
              key={link.page}
              type="button"
              className={`nav-link${currentPage === link.page ? " active" : ""}`}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="nav-icons">
          {/* Decorative — mic/camera only ever mean something inside an
              actual room's call. The profile icon is a real shortcut. */}
          <span className="nav-icon" aria-hidden="true">
            🎙️
          </span>
          <span className="nav-icon" aria-hidden="true">
            🎥
          </span>
          <button
            type="button"
            className="nav-icon nav-icon-button"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
          >
            👤
          </button>
        </div>
      </nav>
      <div className="nav-glow-line" aria-hidden="true" />
    </>
  );
}
