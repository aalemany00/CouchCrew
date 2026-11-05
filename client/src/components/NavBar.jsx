import { useState } from "react";
import { navigate } from "../lib/router";
import MediaDeviceSettings from "./MediaDeviceSettings";

const NAV_LINKS = [
  { page: "home", path: "/", label: "Home" },
  { page: "themes", path: "/themes", label: "Themes" },
  { page: "settings", path: "/settings", label: "Settings" },
  { page: "help", path: "/help", label: "Help" },
];

export default function NavBar({ currentPage }) {
  const [devicePanelOpen, setDevicePanelOpen] = useState(false);

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
          {/* Lets someone check/pick their mic and camera before ever
              joining a room, not just from inside one's settings drawer. */}
          <button
            type="button"
            className="nav-icon nav-icon-button"
            onClick={() => setDevicePanelOpen((v) => !v)}
            aria-label="Mic and camera settings"
          >
            🎙️
          </button>
          <button
            type="button"
            className="nav-icon nav-icon-button"
            onClick={() => setDevicePanelOpen((v) => !v)}
            aria-label="Mic and camera settings"
          >
            🎥
          </button>
          <button
            type="button"
            className="nav-icon nav-icon-button"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
          >
            👤
          </button>
        </div>

        {devicePanelOpen && (
          <>
            <div className="nav-popover-backdrop" onClick={() => setDevicePanelOpen(false)} />
            <div className="nav-device-popover" role="dialog" aria-label="Mic and camera settings">
              <div className="drawer-header">
                <h3>Video &amp; Mic</h3>
                <button
                  type="button"
                  className="drawer-close"
                  onClick={() => setDevicePanelOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <MediaDeviceSettings />
            </div>
          </>
        )}
      </nav>
      <div className="nav-glow-line" aria-hidden="true" />
    </>
  );
}
