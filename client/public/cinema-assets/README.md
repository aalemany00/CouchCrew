# CouchCrew photo-assets staging area

This branch wires **four separate, photorealistic image layers** into the Classic home and room while preserving the SVG fallback and all React controls.

Binary images are delivered separately in the downloadable `CouchCrew_Realism_Asset_Pack.zip` in the associated ChatGPT conversation. They **must be copied into this directory before the photographs display on Vercel**. The code is defensive: while files are absent or still loading, the original artwork remains visible.

Required paths:
- `lobby-background.webp` (opaque 1774×887)
- `auditorium-classic.webp` (opaque 1817×866)
- `screen-frame.png` (alpha PNG 1672×941, center transparent)
- `foreground-seats.png` (alpha PNG 1914×822, top transparent)

The ZIP includes an idempotent installer script that copies the images to this folder. Run it on a local checkout, commit the binary files, and validate room/chat/video and mobile alignment before merging. Other seven themes are unchanged.