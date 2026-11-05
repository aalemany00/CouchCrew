const KEY = "couchcrew:recentRooms";
const MAX_RECENT_ROOMS = 5;

export function getRecentRooms() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function rememberRecentRoom(roomId) {
  try {
    const next = [roomId, ...getRecentRooms().filter((id) => id !== roomId)].slice(0, MAX_RECENT_ROOMS);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore — just a convenience list
  }
}

export function removeRecentRoom(roomId) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getRecentRooms().filter((id) => id !== roomId)));
  } catch {
    // ignore — just a convenience list
  }
}
