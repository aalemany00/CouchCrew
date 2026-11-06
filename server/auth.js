// Account routes: sign up, sign in, change password, and a security-
// question-based password reset (no email service is set up for this
// project, so a real "reset link in your inbox" flow isn't available -
// this is the accepted, weaker-but-self-contained tradeoff, decided with
// Adrian; see LOG.md).
import {
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  getUserByEmail,
  getUserByToken,
  toPublicUser,
  updatePassword,
  updateProfile,
  verifyPassword,
  verifySecurityAnswer,
} from "./db.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const user = token ? await getUserByToken(token) : null;
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  req.user = user;
  req.token = token;
  next();
}

export function registerAuthRoutes(app) {
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name, securityQuestion, securityAnswer } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Enter a display name." });
    }
    if (!securityQuestion?.trim() || !securityAnswer?.trim()) {
      return res.status(400).json({ error: "Set a security question and answer, in case you forget your password." });
    }
    if (await getUserByEmail(email)) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    const user = await createUser({
      email,
      password,
      name: name.trim().slice(0, 40),
      securityQuestion: securityQuestion.trim().slice(0, 200),
      securityAnswer,
    });
    const token = await createSession(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    const user = email ? await getUserByEmail(email) : null;
    // Same message either way - don't let a login attempt reveal whether
    // an email has an account at all.
    if (!user || !verifyPassword(user, password || "")) {
      return res.status(401).json({ error: "Wrong email or password." });
    }
    const token = await createSession(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    await deleteSession(req.token);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user) });
  });

  // Step 1 of the reset flow: look up the question for an email. This does
  // confirm whether an account exists (a real email-link reset wouldn't),
  // which is the known tradeoff of a security-question reset with no email
  // service - accepted for this project rather than building one.
  app.post("/api/auth/security-question", async (req, res) => {
    const { email } = req.body || {};
    const user = email ? await getUserByEmail(email) : null;
    if (!user) return res.status(404).json({ error: "No account with that email." });
    res.json({ securityQuestion: user.security_question });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, securityAnswer, newPassword } = req.body || {};
    const user = email ? await getUserByEmail(email) : null;
    if (!user || !verifySecurityAnswer(user, securityAnswer)) {
      return res.status(401).json({ error: "That answer doesn't match." });
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    await updatePassword(user.id, newPassword);
    const token = await createSession(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!verifyPassword(req.user, currentPassword || "")) {
      return res.status(401).json({ error: "Current password is wrong." });
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    await updatePassword(req.user.id, newPassword);
    res.json({ ok: true });
  });

  // Irreversible - requires the current password, same as changing it,
  // rather than being a single click. Also clears every session for this
  // account (not just the one making the request).
  app.delete("/api/auth/account", requireAuth, async (req, res) => {
    const { password } = req.body || {};
    if (!verifyPassword(req.user, password || "")) {
      return res.status(401).json({ error: "Password is wrong." });
    }
    await deleteUser(req.user.id);
    res.json({ ok: true });
  });

  // Only name/avatar/bio - the fields that sync into rooms. Email and
  // password are never touched here.
  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    const { name, avatar, bio } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Enter a display name." });
    }
    const user = await updateProfile(req.user.id, {
      name: name.trim().slice(0, 40),
      avatar: typeof avatar === "string" ? avatar : null,
      bio: typeof bio === "string" ? bio.slice(0, 160) : null,
    });
    res.json({ user: toPublicUser(user) });
  });
}
