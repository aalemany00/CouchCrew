import { useState } from "react";
import { navigate } from "../lib/router";
import { checkRoomExists } from "../lib/roomApi";
import { ScreenBackdrop, PopcornAndReel, SeatsRow } from "./TheaterArt";

// Theme picking lives only on the Themes tab; the room code (optional) is
// asked for on the Create screen along with your name, not here - see
// CreateRoomScreen.jsx. This page is just "create" or "join."
export default function HomePage() {
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleJoinSubmit(e) {
    e.preventDefault();
    const trimmed = joinCode.trim().toLowerCase();
    if (!trimmed) {
      setJoinError("Type a room code to join.");
      return;
    }
    setJoinError("");
    setChecking(true);
    const exists = await checkRoomExists(trimmed);
    setChecking(false);
    // `null` means the existence check itself failed (server unreachable) -
    // don't block joining over that, just let the attempt through.
    if (exists === false) {
      setJoinError("No room found with that code — double-check it, or ask for a fresh invite link.");
      return;
    }
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
                <button type="button" className="ticket-button" onClick={() => navigate("/create")}>
                  ★ Create a Room ★
                </button>
                <div className="join-divider">or</div>
                {!joinOpen ? (
                  <button type="button" className="secondary" onClick={() => setJoinOpen(true)}>
                    Join with a code
                  </button>
                ) : (
                  <form className="join-code-form" onSubmit={handleJoinSubmit}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Room code (from a link a friend sent you)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      disabled={checking}
                    />
                    <button type="submit" disabled={checking}>
                      {checking ? "Checking…" : "Join"}
                    </button>
                  </form>
                )}
                {joinError && <p className="watch-error">{joinError}</p>}
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
