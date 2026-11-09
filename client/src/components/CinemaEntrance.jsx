import { useEffect, useRef, useState } from "react";
import entranceArt from "../art/cinemaEntranceHtml";
import { startEntranceAnimations } from "../art/entranceAnimations";

// Home screen for every theme: a theater entrance drawn on a fixed 1280x820
// stage that is scaled to fit the window (width AND height, so widescreen
// monitors don't cut it off) and centered, with the wall/floor continued at the
// sides. Narrow windows and phones get CinemaEntranceCompact instead. The artwork is
// decorative; the two real controls (Create a Room, Join with a code) are
// ordinary React elements laid over it, and all behavior (room-code check,
// navigation, errors) is owned by HomePage and passed in - nothing about how
// rooms are created or joined lives here.
const STAGE_W = 1280;
const STAGE_H = 820;

export default function CinemaEntrance({ onCreate, joinCode, onJoinCodeChange, onJoinSubmit, joinError, checking }) {
  const rootRef = useRef(null);
  const artRef = useRef(null);
  const [scale, setScale] = useState(() => (typeof window === "undefined" ? 1 : window.innerWidth / STAGE_W));
  const [left, setLeft] = useState(0);
  // The scene starts just below the real nav bar (its height changes once web
  // fonts load), so nothing overlaps it.
  const [top, setTop] = useState(0);

  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector(".nav-bar");
      const glow = document.querySelector(".nav-glow-line");
      const bottom = Math.ceil(Math.max(nav?.getBoundingClientRect().bottom ?? 0, glow?.getBoundingClientRect().bottom ?? 0));
      // The stage is drawn 40px above its box (marginTop), so 780 stage-px are visible.
      const s = Math.min(window.innerWidth / STAGE_W, (window.innerHeight - bottom) / (STAGE_H - 40));
      setScale(s);
      setLeft((window.innerWidth - STAGE_W * s) / 2);
      setTop(bottom);
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Ambient animations (popcorn, soda, bulbs, walkers, doors). Skipped when the
  // visitor prefers reduced motion.
  useEffect(() => {
    if (!artRef.current) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    return startEntranceAnimations(artRef.current);
  }, []);

  return (
    <div className="ce-root" ref={rootRef} style={{ top, "--s": scale, "--gap": `${Math.max(left, 0)}px` }}>
      <div className="ce-fill" aria-hidden="true" />
      <div className="ce-stage" style={{ width: STAGE_W, height: STAGE_H, left, transform: `scale(${scale})`, marginTop: -40 * scale }}>
        <div className="ce-art" ref={artRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: entranceArt }} />

        <button type="button" className="ce-ticket" onClick={onCreate}>
          <span className="ce-ticket-main">
            BUY A TICKET
            <small>CREATE A ROOM</small>
          </span>
          <span className="ce-ticket-stub">
            ADMIT
            <br />
            ONE
          </span>
        </button>

        <form className="ce-code" onSubmit={onJoinSubmit}>
          <label htmlFor="ce-code-input">HAVE A TICKET? ENTER CODE</label>
          <div className="ce-code-row">
            <input
              id="ce-code-input"
              type="text"
              placeholder="MOVIE-NIGHT-7QK"
              value={joinCode}
              onChange={(e) => onJoinCodeChange(e.target.value)}
              disabled={checking}
              autoComplete="off"
            />
            <button type="submit" disabled={checking}>
              {checking ? "…" : "JOIN"}
            </button>
          </div>
          {joinError && <p className="ce-code-error">{joinError}</p>}
        </form>
      </div>
    </div>
  );
}

// Phones and narrow windows: the same entrance as a simple stack - sign, box
// office (create a room) and the theater door (join with a code).
export function CinemaEntranceCompact({ onCreate, joinCode, onJoinCodeChange, onJoinSubmit, joinError, checking }) {
  return (
    <div className="cm-root">
      <header className="cm-sign">
        <h1>CouchCrew</h1>
        <p>WATCH TOGETHER, ANYWHERE</p>
      </header>

      <section className="cm-card">
        <h2>BOX OFFICE</h2>
        <button type="button" className="ce-ticket" onClick={onCreate}>
          <span className="ce-ticket-main">
            BUY A TICKET
            <small>CREATE A ROOM</small>
          </span>
          <span className="ce-ticket-stub">
            ADMIT
            <br />
            ONE
          </span>
        </button>
      </section>

      <section className="cm-card door">
        <h2>THEATER 1 ENTRANCE</h2>
        <form className="ce-code" onSubmit={onJoinSubmit}>
          <label htmlFor="cm-code-input">HAVE A TICKET? ENTER CODE</label>
          <div className="ce-code-row">
            <input
              id="cm-code-input"
              type="text"
              placeholder="MOVIE-NIGHT-7QK"
              value={joinCode}
              onChange={(e) => onJoinCodeChange(e.target.value)}
              disabled={checking}
              autoComplete="off"
            />
            <button type="submit" disabled={checking}>
              {checking ? "…" : "JOIN"}
            </button>
          </div>
          {joinError && <p className="ce-code-error">{joinError}</p>}
        </form>
      </section>
    </div>
  );
}
