import { useEffect, useState } from "react";
import { navigate } from "../lib/router";
import { checkRoomExists } from "../lib/roomApi";
import { ScreenBackdrop, PopcornAndReel, SeatsRow } from "./TheaterArt";
import CinemaEntrance, { CinemaEntranceCompact } from "./CinemaEntrance";

// Theme picking lives only on the Themes tab; the room code (optional) is
// asked for on the Create screen along with your name, not here - see
// CreateRoomScreen.jsx. This page is just "create" or "join."
export default function HomePage({ theme = "classic" }) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [checking, setChecking] = useState(false);
  // Every theme gets the cinema entrance: the full scene from 820px wide, a
  // compact stacked version below that. The original drive-in hero further down
  // is only a last-resort fallback for tiny (< 340px) windows.
  const query = (min) => window.matchMedia(`(min-width: ${min}px)`);
  const sizeOf = () => (query(820).matches ? "wide" : query(340).matches ? "compact" : "legacy");
  const [size, setSize] = useState(sizeOf);
  useEffect(() => {
    const onChange = () => setSize(sizeOf());
    const mqs = [query(820), query(340)];
    mqs.forEach((mq) => mq.addEventListener("change", onChange));
    return () => mqs.forEach((mq) => mq.removeEventListener("change", onChange));
  }, []);

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

  if (size !== "legacy") {
    const Entrance = size === "wide" ? CinemaEntrance : CinemaEntranceCompact;
    return (
      <Entrance
        onCreate={() => navigate("/create")}
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        onJoinSubmit={handleJoinSubmit}
        joinError={joinError}
        checking={checking}
      />
    );
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
