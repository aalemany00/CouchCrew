import { useEffect, useRef, useState } from "react";
import entranceArt from "../art/cinemaEntranceHtml";
import { startEntranceAnimations } from "../art/entranceAnimations";

// Default (classic) theme home screen: a theater entrance drawn on a fixed
// 1280x820 stage that is scaled to the window width. The artwork is
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
  // The scene starts just below the real nav bar (its height changes once web
  // fonts load), so nothing overlaps it.
  const [top, setTop] = useState(0);

  useEffect(() => {
    const measure = () => {
      setScale(window.innerWidth / STAGE_W);
      const nav = document.querySelector(".nav-bar");
      const glow = document.querySelector(".nav-glow-line");
      const bottom = Math.max(nav?.getBoundingClientRect().bottom ?? 0, glow?.getBoundingClientRect().bottom ?? 0);
      setTop(Math.ceil(bottom));
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
    <div className="ce-root" ref={rootRef} style={{ top }}>
      <div className="ce-stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, marginTop: -40 * scale }}>
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
