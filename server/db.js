// Account storage: SQLite (Node's built-in node:sqlite - no extra
// dependency, no native module to build/deploy). A single file alongside
// the server; on a host with an ephemeral filesystem (e.g. Render's free
// tier) this resets on redeploy, which is an accepted tradeoff for a
// course project, not something production-grade.
//
// Passwords and security-question answers are never stored in plain text -
// scryptSync (built into node:crypto, no bcrypt dependency needed) with a
// random salt per secret, in "<salt>:<hash>" form, compared with
// timingSafeEqual so a wrong guess can't be timed to narrow it down.
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "couchcrew.db");

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

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

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) || null;
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

export function createUser({ email, password, name, securityQuestion, securityAnswer }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, avatar, bio, security_question, security_answer_hash, created_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`
  ).run(
    id,
    email.toLowerCase(),
    hashSecret(password),
    name,
    securityQuestion,
    hashSecret(securityAnswer.toLowerCase().trim()),
    Date.now()
  );
  return getUserById(id);
}

export function verifyPassword(user, password) {
  return verifySecret(password, user.password_hash);
}

export function verifySecurityAnswer(user, answer) {
  return verifySecret((answer || "").toLowerCase().trim(), user.security_answer_hash);
}

export function updatePassword(userId, newPassword) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashSecret(newPassword), userId);
}

// Deliberately only touches name/avatar/bio - the fields that are allowed
// to "translate over to rooms" (see server/index.js's room:join/
// profile:update). Email and password live only here and in /api/auth/me,
// never broadcast to a room or another viewer.
export function updateProfile(userId, { name, avatar, bio }) {
  db.prepare("UPDATE users SET name = ?, avatar = ?, bio = ? WHERE id = ?").run(
    name,
    avatar ?? null,
    bio ?? null,
    userId
  );
  return getUserById(userId);
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    Date.now()
  );
  return token;
}

export function getUserByToken(token) {
  const row = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token);
  return row ? getUserById(row.user_id) : null;
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
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
  };
}
