// Hand-built SVG illustrations for the Home hero, standing in for real
// artwork since this session has no image-generation tool. Built to match
// the structure of the one reference mockup Adrian provided (drive-in
// screen: night sky, spotlights, skyline, palms) as closely as code allows.

export function ScreenBackdrop() {
  return (
    <svg
      className="screen-backdrop"
      viewBox="0 0 600 340"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241a3a" />
          <stop offset="55%" stopColor="#2e1f45" />
          <stop offset="100%" stopColor="#140d22" />
        </linearGradient>
        <radialGradient id="glowGrad" cx="50%" cy="100%" r="75%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <path id="palmLeaf" d="M0,0 Q 26,-10 54,-3 Q 30,5 0,0 Z" />
      </defs>

      <rect width="600" height="340" fill="url(#skyGrad)" />
      <rect width="600" height="340" fill="url(#glowGrad)" />

      {/* searchlight beams fanning up from behind the logo */}
      <g opacity="0.22" fill="#fff6d8">
        <polygon points="300,340 180,0 220,0" />
        <polygon points="300,340 260,0 300,0" />
        <polygon points="300,340 340,0 380,0" />
        <polygon points="300,340 420,0 380,0" />
      </g>

      {/* city skyline silhouette */}
      <g fill="#0f0a1a">
        <rect x="0" y="270" width="40" height="70" />
        <rect x="42" y="250" width="30" height="90" />
        <rect x="75" y="285" width="45" height="55" />
        <rect x="122" y="260" width="24" height="80" />
        <rect x="460" y="265" width="26" height="75" />
        <rect x="490" y="290" width="40" height="50" />
        <rect x="532" y="245" width="30" height="95" />
        <rect x="565" y="275" width="35" height="65" />
      </g>

      {/* two palm trees flanking the lower-center, each a curved trunk
          with six fan fronds radiating from the crown */}
      {[
        { cx: 112, lean: 6 },
        { cx: 488, lean: -6 },
      ].map((p) => (
        <g key={p.cx} fill="#120b1e">
          <path
            d={`M${p.cx - 5} 340 Q ${p.cx - 14 + p.lean} 300 ${p.cx + p.lean} 258 Q ${p.cx + 14 + p.lean} 300 ${p.cx + 5} 340 Z`}
          />
          {[-160, -122, -84, -46, -8, 30].map((deg) => (
            <use
              key={deg}
              href="#palmLeaf"
              transform={`translate(${p.cx + p.lean},258) rotate(${deg})`}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function PopcornAndReel() {
  return (
    <svg
      className="popcorn-reel-art"
      viewBox="0 0 220 180"
      aria-hidden="true"
    >
      {/* film reel, tucked behind/right of the bucket */}
      <g transform="translate(130,40) rotate(-12)">
        <circle cx="0" cy="0" r="46" fill="none" stroke="#caa33a" strokeWidth="6" />
        <circle cx="0" cy="0" r="10" fill="#caa33a" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <circle
            key={deg}
            cx={28 * Math.cos((deg * Math.PI) / 180)}
            cy={28 * Math.sin((deg * Math.PI) / 180)}
            r="9"
            fill="#0d0f16"
          />
        ))}
        {/* unspooling film strip */}
        <g stroke="#caa33a" strokeWidth="10" fill="none">
          <path d="M40 10 C 90 20, 120 45, 150 80" />
        </g>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={50 + i * 25}
            y={10 + i * 15}
            width="7"
            height="7"
            fill="#0d0f16"
            transform={`rotate(${25 + i * 3} ${53 + i * 25} ${13 + i * 15})`}
          />
        ))}
      </g>

      {/* popcorn bucket, front and center */}
      <g transform="translate(20,70)">
        <path d="M8 30 L78 30 L68 140 L18 140 Z" fill="#c4172a" />
        <path d="M8 30 L78 30 L68 140 L18 140 Z" fill="none" />
        {[0, 1, 2, 3].map((i) => (
          <polygon
            key={i}
            points={`${8 + i * 17.5},30 ${8 + i * 17.5 + 8.75},30 ${18 + i * 12.5},140 ${18 + (i - 1) * 12.5 + 12},140`}
            fill={i % 2 === 0 ? "#f4ecd8" : "#c4172a"}
          />
        ))}
        <ellipse cx="43" cy="30" rx="35" ry="8" fill="#f4ecd8" />
        {/* overflowing popcorn */}
        <g fill="#fdf3cf" stroke="#e8dba8" strokeWidth="1">
          <circle cx="15" cy="20" r="10" />
          <circle cx="30" cy="10" r="11" />
          <circle cx="46" cy="6" r="12" />
          <circle cx="62" cy="10" r="11" />
          <circle cx="75" cy="20" r="10" />
          <circle cx="22" cy="28" r="9" />
          <circle cx="40" cy="22" r="9" />
          <circle cx="58" cy="26" r="9" />
        </g>
      </g>
    </svg>
  );
}

export function SeatsRow() {
  return (
    <svg
      className="seats-row"
      viewBox="0 0 600 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g fill="#2a0f14">
        {Array.from({ length: 16 }).map((_, i) => (
          <g key={i} transform={`translate(${i * 38}, 0)`}>
            <rect x="4" y="18" width="30" height="34" rx="6" />
            <rect x="4" y="10" width="30" height="16" rx="8" />
          </g>
        ))}
      </g>
    </svg>
  );
}
