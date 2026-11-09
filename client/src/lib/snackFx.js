// Sound + particle effects for the chat snack buttons (popcorn / soda / candy).
// Sounds are synthesized with the Web Audio API (no audio files to ship); particles
// are short-lived fixed-position DOM nodes animated with transform/opacity only.
// Everything is best-effort: if audio or animation isn't available it silently skips.

let ctx = null;
let noiseBuf = null;

function audio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch {
    return null;
  }
}

// One filtered noise burst: the building block for pops, fizz and crinkles.
function burst(c, { at = 0, dur = 0.05, type = "bandpass", freq = 1800, q = 1, gain = 0.3, attack = 0.002 }) {
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.5;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function thump(c, { at = 0, from = 180, to = 60, dur = 0.12, gain = 0.25 }) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  // kernels popping: a few sharp clicks at random times + a soft thump
  popcorn(c, big) {
    const n = big ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const at = Math.random() * (big ? 0.7 : 0.35);
      burst(c, { at, dur: 0.045, freq: 1400 + Math.random() * 1800, q: 2.5, gain: 0.35 });
      thump(c, { at, from: 220 + Math.random() * 120, to: 90, dur: 0.05, gain: 0.08 });
    }
  },
  // can opening: a sharp tick, then a hiss and fizz that fade out
  soda(c, big) {
    burst(c, { at: 0, dur: 0.03, type: "highpass", freq: 3000, gain: 0.35 });
    thump(c, { at: 0, from: 520, to: 260, dur: 0.06, gain: 0.12 });
    burst(c, { at: 0.04, dur: big ? 1.2 : 0.7, type: "highpass", freq: 5200, q: 0.4, gain: 0.16, attack: 0.05 });
    for (let i = 0; i < (big ? 14 : 7); i++) {
      burst(c, { at: 0.1 + Math.random() * (big ? 1 : 0.55), dur: 0.02, type: "bandpass", freq: 2500 + Math.random() * 3500, q: 4, gain: 0.12 });
    }
  },
  // candy wrapper: lots of tiny, bright, uneven crinkles
  candy(c, big) {
    const n = big ? 34 : 16;
    for (let i = 0; i < n; i++) {
      burst(c, {
        at: Math.random() * (big ? 0.9 : 0.5),
        dur: 0.012 + Math.random() * 0.02,
        type: "highpass",
        freq: 3500 + Math.random() * 3500,
        gain: 0.1 + Math.random() * 0.14,
      });
    }
  },
};

const PARTICLES = {
  popcorn: { glyphs: ["🍿", "🌽", "✨"], count: 9, rise: 1, spread: 90, gravity: 70 },
  soda: { glyphs: ["🫧", "💧", "🥤"], count: 10, rise: 1, spread: 60, gravity: 20 },
  candy: { glyphs: ["🍬", "✨", "🍭"], count: 9, rise: 0.8, spread: 100, gravity: 60 },
};

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function particles(kind, el, big) {
  if (reducedMotion() || !el || !el.animate) return;
  const cfg = PARTICLES[kind] || PARTICLES.popcorn;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const n = big ? cfg.count * 2 : cfg.count;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.textContent = cfg.glyphs[Math.floor(Math.random() * cfg.glyphs.length)];
    p.setAttribute("aria-hidden", "true");
    p.style.cssText =
      `position:fixed;left:${cx}px;top:${cy}px;z-index:2000;pointer-events:none;` +
      `font-size:${12 + Math.random() * 12}px;line-height:1;will-change:transform,opacity;margin:-8px 0 0 -8px`;
    document.body.appendChild(p);
    const dx = (Math.random() - 0.5) * 2 * cfg.spread * (big ? 1.4 : 1);
    const up = (40 + Math.random() * 70) * cfg.rise * (big ? 1.3 : 1);
    const rot = (Math.random() - 0.5) * 540;
    const dur = 650 + Math.random() * 450;
    const anim = p.animate(
      [
        { transform: "translate(0,0) scale(.4) rotate(0deg)", opacity: 0 },
        { transform: `translate(${dx * 0.55}px,${-up}px) scale(1.1) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px,${cfg.gravity - up * 0.1}px) scale(.8) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }
    );
    anim.onfinish = () => p.remove();
  }
}

function press(el) {
  if (reducedMotion() || !el || !el.animate) return;
  el.animate(
    [
      { transform: "scale(1) rotate(0deg)" },
      { transform: "scale(.82) rotate(-6deg)", offset: 0.2 },
      { transform: "scale(1.3) rotate(8deg)", offset: 0.55 },
      { transform: "scale(1) rotate(0deg)" },
    ],
    { duration: 380, easing: "ease-out" }
  );
}

/** Play the sound + particles for one snack click. `big` = the triple-click easter egg. */
export function snackFx(kind, el, big = false) {
  press(el);
  particles(kind, el, big);
  const c = audio();
  if (c && SOUNDS[kind]) {
    try {
      SOUNDS[kind](c, big);
    } catch {
      /* audio is decoration only */
    }
  }
}
