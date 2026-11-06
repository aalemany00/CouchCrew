// Account storage: libSQL (Turso's client), the same SQL/SQLite dialect as
// before but talking to a real persistent database instead of a file on the
// server's own disk. That file-on-disk approach (node:sqlite) worked locally
// but silently lost every account on Render's free tier: Render's free web
// services have an ephemeral filesystem that resets on every redeploy,
// restart, or spin-down - confirmed against Render's own docs, not assumed
// (see LOG.md). Render's own free Postgres/Key-Value aren't durable either
// (Postgres expires after 30 days free; Key-Value doesn't persist restarts),
// so this needs an external service - Turso's free tier (5GB, ~500M reads/
// 10M writes a month, no card) comfortably covers this project.
//
// Locally, with no TURSO_DATABASE_URL set, this falls back to a local file
// (libSQL's own embedded mode) - so running the server locally needs no
// Turso account at all, same "free with no setup locally, real credentials
// only in production" pattern as the Cloudflare TURN relay.
//
// Passwords and security-question answers are never stored in plain text -
// scryptSync (built into node:crypto, no bcrypt dependency needed) with a
// random salt per secret, in "<salt>:<hash>" form, compared with
// timingSafeEqual so a wrong guess can't be timed to narrow it down.
import { createClient } from "@libsql/client";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeveloperEmail } from "./developer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = path.join(__dirname, "couchcrew.db");

export const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: `file:${LOCAL_DB_PATH}` }
);

export const ready = db.batch(
  [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      bio TEXT,
      security_question TEXT NOT NULL,
      security_answer_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ],
  "write"
);

function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(secret, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function row(result) {
  if (!result.rows.length) return null;
  const cols = result.columns;
  const r = result.rows[0];
  return Object.fromEntries(cols.map((c, i) => [c, r[i]]));
}

export async function getUserByEmail(email) {
  await ready;
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email.toLowerCase()],
  });
  return row(result);
}

export async function getUserById(id) {
  await ready;
  const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return row(result);
}

// Admin-only (see server/auth.js's requireDeveloper) - every account, so
// the developer's Settings page can list and clean up test accounts.
export async function getAllUsers() {
  await ready;
  const result = await db.execute("SELECT * FROM users ORDER BY created_at ASC");
  const cols = result.columns;
  return result.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

export async function createUser({ email, password, name, securityQuestion, securityAnswer }) {
  await ready;
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, avatar, bio, security_question, security_answer_hash, created_at)
          VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    args: [
      id,
      email.toLowerCase(),
      hashSecret(password),
      name,
      securityQuestion,
      hashSecret(securityAnswer.toLowerCase().trim()),
      Date.now(),
    ],
  });
  return getUserById(id);
}

export function verifyPassword(user, password) {
  return verifySecret(password, user.password_hash);
}

export function verifySecurityAnswer(user, answer) {
  return verifySecret((answer || "").toLowerCase().trim(), user.security_answer_hash);
}

export async function updatePassword(userId, newPassword) {
  await ready;
  await db.execute({
    sql: "UPDATE users SET password_hash = ? WHERE id = ?",
    args: [hashSecret(newPassword), userId],
  });
}

// Deliberately only touches name/avatar/bio - the fields that are allowed
// to "translate over to rooms" (see server/index.js's room:join/
// profile:update). Email and password live only here and in /api/auth/me,
// never broadcast to a room or another viewer.
export async function updateProfile(userId, { name, avatar, bio }) {
  await ready;
  await db.execute({
    sql: "UPDATE users SET name = ?, avatar = ?, bio = ? WHERE id = ?",
    args: [name, avatar ?? null, bio ?? null, userId],
  });
  return getUserById(userId);
}

export async function deleteUser(userId) {
  await ready;
  await db.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
}

export async function createSession(userId) {
  await ready;
  const token = randomBytes(32).toString("hex");
  await db.execute({
    sql: "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
    args: [token, userId, Date.now()],
  });
  return token;
}

export async function getUserByToken(token) {
  await ready;
  const result = await db.execute({
    sql: "SELECT user_id FROM sessions WHERE token = ?",
    args: [token],
  });
  const r = row(result);
  return r ? getUserById(r.user_id) : null;
}

export async function deleteSession(token) {
  await ready;
  await db.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
}

// Never include password_hash/security_answer_hash past this point - this
// is what the client ever sees of its own account.
export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    securityQuestion: user.security_question,
    isDeveloper: isDeveloperEmail(user.email),
    createdAt: user.created_at,
  };
}
