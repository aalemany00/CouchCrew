// Reads/writes the room id in the URL path (/r/<code>) so a room has a
// real shareable link, and a page refresh can tell which room to rejoin.
const ROOM_PATH_RE = /^\/r\/([a-zA-Z0-9-]+)\/?$/;

export function getRoomIdFromPath() {
  const match = window.location.pathname.match(ROOM_PATH_RE);
  return match ? match[1] : null;
}

export function setRoomPath(roomId) {
  window.history.pushState({}, "", `/r/${roomId}`);
}

export function clearRoomPath() {
  window.history.pushState({}, "", "/");
}
