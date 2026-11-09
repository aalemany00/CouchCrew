// Account client: talks to server/auth.js and keeps the session token +
// cached user in localStorage. Signing in also copies the account's
// name/avatar/bio into the same "couchcrew:name"/"couchcrew:avatar"/
// "couchcrew:bio" keys ProfileForm/RoomView/ChatPanel already read -
// that's the entire mechanism for "profile translates over to rooms";
// none of those files need to know accounts exist. Email and password
// never go into those keys and never get sent to a room.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const TOKEN_KEY = "couchcrew:authToken";
const USER_KEY = "couchcrew:authUser";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem("couchcrew:name", user.name || "");
    localStorage.setItem("couchcrew:bio", user.bio || "");
    if (user.avatar) localStorage.setItem("couchcrew:avatar", user.avatar);
    else localStorage.removeItem("couchcrew:avatar");
  } catch {
    // Storage can be unavailable (private browsing, etc.) - the session
    // just won't persist across a reload.
  }
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}

export async function signUp({ email, password, name, securityQuestion, securityAnswer }) {
  const body = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name, securityQuestion, securityAnswer }),
  });
  saveSession(body.token, body.user);
  return body.user;
}

export async function signIn({ email, password }) {
  const body = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveSession(body.token, body.user);
  return body.user;
}

export async function signOut() {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    // Already signed out, or the server's unreachable - clear locally
    // either way so the UI doesn't get stuck thinking it's logged in.
  }
  clearSession();
}

// Confirms the cached session is still good (a session doesn't expire here,
// but could have been signed out from elsewhere) and refreshes the cached
// profile fields in case they changed since.
export async function fetchMe() {
  if (!getToken()) return null;
  try {
    const body = await request("/api/auth/me");
    saveSession(getToken(), body.user);
    return body.user;
  } catch {
    clearSession();
    return null;
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  await request("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// Permanently deletes the account server-side (requires the password, same
// as changing it) and clears the local session. Doesn't touch
// couchcrew:name/avatar/bio - those stay as a local, no-longer-account-
// backed profile, same as before ever signing up.
export async function deleteAccount({ password }) {
  await request("/api/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
  clearSession();
}

export async function updateAccountProfile({ name, avatar, bio }) {
  const body = await request("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ name, avatar, bio }),
  });
  saveSession(getToken(), body.user);
  return body.user;
}

export async function getSecurityQuestion(email) {
  const body = await request("/api/auth/security-question", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return body.securityQuestion;
}

export async function resetPassword({ email, securityAnswer, newPassword }) {
  const body = await request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, securityAnswer, newPassword }),
  });
  saveSession(body.token, body.user);
  return body.user;
}

// Admin-only (see server/auth.js's requireDeveloper) - 403s for anyone else.
export async function listAllAccounts() {
  const body = await request("/api/admin/users");
  return body.users;
}

export async function deleteAccountById(id) {
  await request(`/api/admin/users/${id}`, { method: "DELETE" });
}
