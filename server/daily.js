// Daily.co room provisioning (Job 2). The API key stays on the server; the
// client only ever receives the resulting room URL.
const DAILY_API = "https://api.daily.co/v1";
const ROOM_TTL_SECONDS = 60 * 60 * 24; // rooms clean themselves up after 24h

function dailyHeaders() {
  return {
    Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// CouchCrew room codes are user-typed, so reduce them to what Daily accepts.
function dailyRoomName(roomId) {
  const slug = String(roomId).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
  return slug ? `couchcrew-${slug}` : null;
}

async function getRoom(name) {
  const res = await fetch(`${DAILY_API}/rooms/${name}`, { headers: dailyHeaders() });
  return res.ok ? res.json() : null;
}

async function createRoom(name) {
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: dailyHeaders(),
    body: JSON.stringify({
      name,
      privacy: "public",
      properties: {
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
        enable_screenshare: true,
        enable_prejoin_ui: false,
      },
    }),
  });
  return res.ok ? res.json() : null;
}

export function registerDailyRoutes(app) {
  // Idempotent: returns the existing Daily room for this roomId or creates it.
  app.post("/daily/room", async (req, res) => {
    if (!process.env.DAILY_API_KEY) {
      return res.status(503).json({ error: "Video is not configured on the server" });
    }
    const name = dailyRoomName(req.body?.roomId);
    if (!name) return res.status(400).json({ error: "roomId is required" });

    try {
      // Two people joining at once can race on create, so re-check on failure.
      const room = (await getRoom(name)) || (await createRoom(name)) || (await getRoom(name));
      if (!room) return res.status(502).json({ error: "Could not create video room" });
      res.json({ url: room.url });
    } catch (err) {
      console.error("daily room error", err);
      res.status(502).json({ error: "Video service unreachable" });
    }
  });
}
