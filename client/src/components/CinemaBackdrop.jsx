import { useEffect, useState } from "react";
import roomHtml from "../art/cinemaRoomHtml";
import auditoriumBackground from "../assets/theater-realistic/auditorium-background.webp";

// Default (classic) theme backdrop: a dark auditorium with pleated side
// curtains, rows of seats (armrests + cupholders) and an audience whose heads
// gently bob. Drawn on a fixed 1280x820 canvas that is scaled to cover the
// window. Purely decorative, behind everything, inert (no pointer events).
// Audience motion is CSS transform-only keyframes (see cinema-default.css).
const W = 1280;
const H = 820;
const fit = () => ({ w: window.innerWidth, h: window.innerHeight });

export default function CinemaBackdrop() {
  const [size, setSize] = useState(fit);
  useEffect(() => {
    const onResize = () => setSize(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Scale to cover the window, centered horizontally and anchored to the
  // BOTTOM so the audience rows stay visible; extra height crops the ceiling.
  const scale = Math.max(size.w / W, size.h / H);
  const left = (size.w - W * scale) / 2;
  const top = size.h - H * scale;
  return (
    <div className="cinema-backdrop" aria-hidden="true">
      {/* Hand-drawn SVG stays mounted underneath for a quick revert (just drop
          the photo div) - see LOG.md, experiment/realistic-theater-art. */}
      <div
        className="cinema-backdrop-canvas"
        style={{ width: W, height: H, transform: `translate(${left}px, ${top}px) scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: roomHtml }}
      />
      <div className="cinema-backdrop-photo" style={{ backgroundImage: `url(${auditoriumBackground})` }} />
    </div>
  );
}
