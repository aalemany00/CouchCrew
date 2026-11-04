// Tiny path-based router — no library, just enough for a handful of fixed
// pages plus the /r/<roomId> room link. Dispatches a popstate event on
// navigate() so components can re-read the route without a page reload.
const ROOM_PATH_RE = /^\/r\/([a-zA-Z0-9-]+)\/?$/;

export function getRoute() {
  const path = window.location.pathname;
  const roomMatch = path.match(ROOM_PATH_RE);
  if (roomMatch) return { page: "room", roomId: roomMatch[1].toLowerCase() };
  if (path === "/rooms") return { page: "rooms" };
  if (path === "/themes") return { page: "themes" };
  if (path === "/settings") return { page: "settings" };
  if (path === "/help") return { page: "help" };
  return { page: "home" };
}

export function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function setRoomPath(roomId) {
  navigate(`/r/${roomId}`);
}
