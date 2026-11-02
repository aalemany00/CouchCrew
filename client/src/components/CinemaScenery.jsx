/* Decorative theater scenery; never intercepts mouse, keyboard, or video events. */
const SCENES = {
  classic: ["🍿","🎞️","🎬","🥤","🎟️","✨"],
  thriller: ["🕵️","🗂️","🔎","🕰️","📁","🌧️"],
  horror: ["🕸️","🕯️","💀","🦇","⚰️","🕷️"],
  comedy: ["🎭","🎤","🎉","🎈","🤡","🎟️"],
  romance: ["🌹","💌","🕯️","🥂","💐","💗"],
  scifi: ["🛸","🪐","👩‍🚀","⚡","🛰️","🌌"],
  fantasy: ["🏰","🐉","⚔️","📜","🧪","✨"],
  action: ["🚁","💥","🚧","📦","🔥","🎯"],
};

export default function CinemaScenery({ theme = "classic" }) {
  const props = SCENES[theme] || SCENES.classic;
  return (
    <div className="cinema-scenery" aria-hidden="true">
      <div className="scene-top" />
      <div className="scene-lights" />
      <div className="scene-curtain left" />
      <div className="scene-curtain right" />
      <div className="scene-props">
        {props.map((prop, i) => <span key={i}>{prop}</span>)}
      </div>
      <div className="scene-floor" />
      <div className="scene-seatbank" />
    </div>
  );
}
