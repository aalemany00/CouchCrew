import { useState } from "react";
import { navigate } from "../lib/router";
import { ScreenBackdrop, PopcornAndReel, SeatsRow } from "./TheaterArt";

// Theme picking lives only on the Themes tab now - Home is just "create" or
// "join." A new room always starts Classic; pick a theme on its own page,
// either before creating a room there or from inside the room's settings.
export default function HomePage({ onCreate, creating }) {
  const [customCode, setCustomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");

  function createRoom() {
    onCreate(customCode, null);
  }

  function joinRoom(e) {
    e.preventDefault();
    const trimmed = joinCode.trim().toLowerCase();
    if (!trimmed) return;
    navigate(`/r/${trimmed}`);
  }

  return (
    <div className="home-page">
      <div className="theater-hero">
        <div className="curtain curtain-left" aria-hidden="true" />
        <div className="curtain curtain-right" aria-hidden="true" />

        <div className="hero-main">
          <div className="hero-screen-wrap">
            <div className="hero-screen">
              <ScreenBackdrop />
              <div className="hero-screen-content">
                <h1 className="hero-logo">CouchCrew</h1>
                <span className="hero-logo-underline" aria-hidden="true" />
                <p className="hero-tagline">WATCH TOGETHER. ANYWHERE.</p>
                <button type="button" className="ticket-button" onClick={createRoom} disabled={creating}>
                  {creating ? "Creating…" : "★ Create a Room ★"}
                </button>
                <input
                  type="text"
                  className="custom-code-input"
                  placeholder="Custom room code (optional)"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  disabled={creating}
                />
                <div className="join-divider">or</div>
                <form className="join-code-form" onSubmit={joinRoom}>
                  <input
                    type="text"
                    placeholder="Room code (from a link a friend sent you)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                  <button type="submit" className="secondary">
                    Join
                  </button>
                </form>
              </div>
            </div>
            <PopcornAndReel />
          </div>
        </div>
      </div>

      <SeatsRow />
    </div>
  );
}
