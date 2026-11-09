// A short, free-text line about yourself, shown when someone taps your
// name or photo in a room (see MemberProfileCard). Same localStorage
// pattern as name/avatar elsewhere in the app.
export function getSavedBio() {
  try {
    return localStorage.getItem("couchcrew:bio") || "";
  } catch {
    return "";
  }
}
