// Internet Archive search + item lookup for Job 3's "Archive.org" watch
// provider. Public-domain films/shows hosted there can be legally played
// back and synced in-app (unlike Netflix/Hulu/etc. - see LOG.md) since
// nothing is embedded that we don't have the right to show. No API key
// needed - archive.org's search/metadata endpoints are free and public.
// Proxied through our own server rather than called from the browser so we
// don't depend on archive.org's CORS behavior and don't have every viewer's
// browser hitting it directly.
const SEARCH_URL = "https://archive.org/advancedsearch.php";
const METADATA_URL = "https://archive.org/metadata";
const FETCH_TIMEOUT_MS = 6000;

export function registerArchiveRoutes(app) {
  app.get("/api/archive/search", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (!q) return res.json({ items: [] });
    try {
      const params = new URLSearchParams({
        q: `title:(${q}) AND mediatype:(movies)`,
        rows: "8",
        output: "json",
      });
      // advancedsearch.php wants a repeated fl[] param per field.
      ["identifier", "title", "year"].forEach((field) => params.append("fl[]", field));
      const res2 = await fetch(`${SEARCH_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res2.ok) throw new Error(`search responded ${res2.status}`);
      const data = await res2.json();
      const items = (data.response?.docs || []).map((d) => ({
        identifier: d.identifier,
        title: d.title || d.identifier,
        year: d.year || null,
      }));
      res.json({ items });
    } catch (err) {
      console.error("archive.org search failed", err);
      res.status(502).json({ items: [], error: "Archive.org search failed" });
    }
  });

  app.get("/api/archive/item/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const metaRes = await fetch(`${METADATA_URL}/${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!metaRes.ok) throw new Error(`metadata responded ${metaRes.status}`);
      const data = await metaRes.json();
      const files = data.files || [];
      // Prefer a real mp4 (h.264) over other formats - playable without
      // plugins in every current browser, unlike some of archive.org's
      // other derivative formats.
      const video =
        files.find((f) => /\.mp4$/i.test(f.name)) || files.find((f) => /\.(webm|ogv)$/i.test(f.name));
      if (!video) {
        res.status(404).json({ error: "No playable video file found for this item." });
        return;
      }
      res.json({
        url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(video.name)}`,
        title: data.metadata?.title || id,
      });
    } catch (err) {
      console.error("archive.org item lookup failed", err);
      res.status(502).json({ error: "Archive.org lookup failed" });
    }
  });
}
