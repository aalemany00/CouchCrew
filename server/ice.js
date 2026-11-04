// Hands the browser its WebRTC "ICE servers" for the video call (Job 2).
// Two people on different networks usually can't connect directly, so the call
// needs a TURN relay. The relay's key stays on the server; browsers only get
// short-lived credentials. With no key configured this returns public STUN
// only, which works on friendly networks and is fine for local development.
const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const TTL_SECONDS = 60 * 60 * 24;
const REFRESH_MS = 60 * 60 * 1000; // reuse one set of credentials for an hour

let cached = null; // { at, iceServers }

async function fetchCloudflareIceServers() {
  const { CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN } = process.env;
  if (!CLOUDFLARE_TURN_KEY_ID || !CLOUDFLARE_TURN_API_TOKEN) return null;
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_TURN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    },
  );
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const body = await res.json();
  return Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];
}

export function registerIceRoute(app) {
  app.get("/ice", async (_req, res) => {
    try {
      if (!cached || Date.now() - cached.at > REFRESH_MS) {
        const relay = await fetchCloudflareIceServers();
        cached = { at: Date.now(), iceServers: relay || STUN, relay: !!relay };
      }
      res.json({ iceServers: cached.iceServers, relay: cached.relay });
    } catch (err) {
      console.error("ice servers error", err);
      // Better a call that works on easy networks than no call at all.
      res.json({ iceServers: STUN, relay: false });
    }
  });
}
