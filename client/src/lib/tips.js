// Whether this browser has already dismissed the room's first-visit tips.
const TIPS_KEY = "couchcrew:tipsDismissed";

export function tipsDismissed() {
  try {
    return localStorage.getItem(TIPS_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberTipsDismissed() {
  try {
    localStorage.setItem(TIPS_KEY, "1");
  } catch {
    // just a convenience
  }
}
