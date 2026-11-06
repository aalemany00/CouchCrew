// A single hardcoded account gets a "developer" badge in rooms and an
// admin view in Settings (list/delete other accounts). Shared here so
// server/index.js (the room badge) and server/auth.js (the admin API)
// check the exact same thing - never two constants that can drift apart.
export const DEVELOPER_EMAIL = "adrian.alemany2@gmail.com";

export function isDeveloperEmail(email) {
  return typeof email === "string" && email.toLowerCase() === DEVELOPER_EMAIL;
}
