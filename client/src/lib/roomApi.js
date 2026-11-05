import { generateRoomCode } from "./roomCode";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const MAX_SUFFIX_TRIES = 30;

async function roomExists(code) {
  try {
    const res = await fetch(`${SERVER_URL}/api/room-exists/${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return !!body.exists;
  } catch {
    // Server unreachable — don't block room creation over it, just go
    // ahead with the requested code as if it were free.
    return false;
  }
}

// Sanitizes a user-typed room code (same charset the router accepts) and, if
// it's already in use, appends "-2", "-3", etc. until a free one is found.
// Falls back to a fresh random code if that search doesn't land anywhere.
export async function claimRoomCode(desired) {
  const base = (desired || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!base) return generateRoomCode();

  if (!(await roomExists(base))) return base;
  for (let n = 2; n < MAX_SUFFIX_TRIES; n++) {
    const candidate = `${base}-${n}`;
    if (!(await roomExists(candidate))) return candidate;
  }
  return `${base}-${generateRoomCode(4)}`;
}
