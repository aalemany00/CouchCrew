import { navigate } from "../lib/router";

const NAV_LINKS = [
  { page: "home", path: "/", label: "Home" },
  { page: "rooms", path: "/rooms", label: "Rooms" },
  { page: "themes", path: "/themes", label: "Themes" },
  { page: "settings", path: "/settings", label: "Settings" },
];

export default function NavBar({ currentPage }) {
  return (
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
    </nav>
  );
}
