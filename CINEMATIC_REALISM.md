# CouchCrew: practical cinematic realism pass

This branch is an **implementable, code-first visual upgrade**, not a screenshot
mockup. It intentionally retains the existing room logic, synchronized player,
camera/mic/screen sharing, member presence, chat, and theme-sync protocol.

## What changed

- \`client/src/components/CinematicScenery.jsx\` contains eight distinct
  decorative SVG theater environments. They are real SVG markup with shared
  perspective geometry, 3D-ish chairs, gradients, grain, architectural
  details, shadows, and warm/cool light sources.
- \`client/src/components/PixelTheaterScenery.jsx\` now chooses that SVG for
  the seven non-classic themes. The **classic** room/lobby still uses the
  existing handcrafted \`CinemaBackdrop\` / \`CinemaEntrance\` work.
- Theme cards use the **actual rendered theater component**, not scaled
  screenshots or a single cropped image reused for each theme.
- \`client/src/cinematic-realism.css\` refines UI materials (brushed-dark
  frame, glass-like surfaces, restrained trim), backdrop and poster rendering,
  and implements a real (local-only) lighting preference.
- The House lights dropdown in \`RoomView.jsx\` switches between
  **Pre-show / Movie / Intermission**. Only the current user's scene changes;
  the choice persists in their browser. No socket event or backend change.

## Why this approach works with ChatGPT or Claude

Everything is HTML, React, CSS, and inline SVG. No Blender scene, WebGL,
paid asset pack, proprietary model, AI-generated background image,
or external texture URL is required.

Theme changes alter **architecture and props**, not merely hue:

| Theme | Reproducible physical details |
|---|---|
| Classic | warm brass sconces, velvet upholstery, picture-palace trim |
| Horror | cracked masonry, cobwebs, foliage, distant moon, candles |
| Romance | flower-covered arches, rose petals, lanterns, blush upholstery |
| Thriller | rain-streaked windows, evidence board, cold skylight |
| Comedy | vaudeville festoons, lamps, comedy/tragedy masks |
| Sci-fi | starship roof, planetary viewport, luminous consoles |
| Fantasy | stone arch, stained-glass windows, torches, banners |
| Action | hangar beams, crates, hazard markings, helicopter silhouette |

## How to iterate

1. Keep the **functional** room components untouched.
2. Change shared geometry (screen, aisles, seats, walls) in
   \`CinematicScenery.jsx\`, not in \`WatchPlayer.jsx\`.
3. Change scene-specific objects in \`VenueProps\`, and per-theme materials
   in \`LOOKS\`.
4. Change UI materials, overlays and lighting in
   \`cinematic-realism.css\` rather than piling more \`!important\` overrides
   into \`immersive-theater.css\`.
5. Always test 360px mobile, 768px tablet, 1280px desktop,
   normal and reduced-motion settings; verify that theme-card previews
   remain different and actual player controls remain clickable.

## What *realism* this does / doesn't do

This is **stylized cinematic realism**, not photorealism.
Gradients and geometry add depth and atmosphere but will not create a
physically accurate camera image. A photoreal pass would need original
environment renders or licensed photos, cut into **separate room-only
backgrounds with no buttons, chat, text, or playable video baked in**.
The React player must remain interactive above the art. Avoid a giant
single screenshot as the app UI; it breaks responsiveness and function.

## Manual checks after deploy

- Home, Themes, Create, Join, Settings, and Help still navigate.
- All eight theme posters have distinct actual scene content.
- Theme selection remains server-controlled by room leader.
- Room invite link, YouTube playback, media devices, chat work normally.
- House lights changes only the local background and persists on refresh.
- No visual SVG intercepts pointer input (\`pointer-events:none\`).
- Reduced-motion preference disables scene ambient animation.
