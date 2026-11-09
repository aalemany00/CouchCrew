import { generateRoomCode, generateRandomSuffix } from "./roomCode";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const MAX_SUFFIX_TRIES = 30;

// Exported so Home's "Join with a code" can tell an empty/mistyped code
// apart from a real one before navigating - landing someone in a brand new,
// empty room under a code they mistyped (instead of their friend's room)
// would look like nothing happened, with no indication anything was wrong.
export async function checkRoomExists(code) {
  try {
    const res = await fetch(`${SERVER_URL}/api/room-exists/${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return !!body.exists;
  } catch {
    // Server unreachable - let the caller decide how to handle "unknown"
    // rather than silently treating it as "doesn't exist".
    return null;
  }
}

// Sanitizes a user-typed room code (same charset the router accepts) and, if
// it's already in use, appends "-2", "-3", etc. until a free one is found.
// Falls back to a fresh random code if that search doesn't land anywhere.
export async function claimRoomCode(desired) {
  const base = (desired || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!base) return generateRoomCode();

  if (!(await checkRoomExists(base))) return base;
  for (let n = 2; n < MAX_SUFFIX_TRIES; n++) {
    const candidate = `${base}-${n}`;
    if (!(await checkRoomExists(candidate))) return candidate;
  }
  return `${base}-${generateRandomSuffix(4)}`;
}
