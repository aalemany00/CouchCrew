import CinemaBackdrop from "./CinemaBackdrop";
import CinematicScenery from "./CinematicScenery";

// Preserve the handcrafted classic auditorium, while replacing the seven
// pixel-art genre backgrounds with browser-native, layered cinematic SVG.
// All room/player/chat behavior remains outside this purely decorative module.
export default function PixelTheaterScenery({ theme = "classic", mode = "lobby" }) {
  if (theme === "classic" && mode !== "poster") return <CinemaBackdrop />;
  return <CinematicScenery theme={theme} mode={mode} />;
}
