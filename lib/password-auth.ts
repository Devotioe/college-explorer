import "server-only";

import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "course_compass_session";
const PASSWORD_ITERATIONS = 210_000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type PasswordUser = { id: string; email: string; displayName: string };

function getDatabase() {
  if (!env.DB) throw new Error("D1 尚未連線");
  return env.DB;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toBase64Url(new Uint8Array(bits));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function registerPasswordUser(emailInput: string, displayNameInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const displayName = displayNameInput.trim().slice(0, 40);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("請輸入有效的 Email");
  if (!displayName) throw new Error("請輸入顯示名稱");
  if (password.length < 8 || password.length > 128) throw new Error("密碼需為 8 至 128 個字元");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  const user = { id: crypto.randomUUID(), email, displayName };
  try {
    await getDatabase().prepare("INSERT INTO password_users (id, email, display_name, password_salt, password_hash, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(user.id, user.email, user.displayName, toBase64Url(salt), passwordHash, PASSWORD_ITERATIONS, Date.now()).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new Error("這個 Email 已經註冊");
    throw error;
  }
  return user;
}

export async function authenticatePasswordUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const row = await getDatabase().prepare("SELECT id, email, display_name AS displayName, password_salt AS passwordSalt, password_hash AS passwordHash, password_iterations AS passwordIterations FROM password_users WHERE email = ? LIMIT 1")
    .bind(email).first<PasswordUser & { passwordSalt: string; passwordHash: string; passwordIterations: number }>();
  if (!row) return null;
  const candidate = await derivePassword(password, fromBase64Url(row.passwordSalt), row.passwordIterations);
  return constantTimeEqual(candidate, row.passwordHash) ? { id: row.id, email: row.email, displayName: row.displayName } : null;
}

export async function createPasswordSession(userId: string) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = Date.now();
  await getDatabase().prepare("INSERT INTO password_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, now + SESSION_MAX_AGE_SECONDS * 1000, now).run();
  return token;
}

export async function destroyPasswordSession(token: string | undefined) {
  if (!token) return;
  await getDatabase().prepare("DELETE FROM password_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export async function getCurrentPasswordUser(): Promise<PasswordUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = Date.now();
  const row = await getDatabase().prepare(`SELECT u.id, u.email, u.display_name AS displayName
    FROM password_sessions s JOIN password_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`).bind(await sha256(token), now).first<PasswordUser>();
  return row ?? null;
}

export function passwordSessionCookie(token: string, request: Request) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const, secure: new URL(request.url).protocol === "https:", path: "/", maxAge: SESSION_MAX_AGE_SECONDS };
}
