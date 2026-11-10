// ── Signed session cookie ─────────────────────────────────────────────────────
// After the hub token (or the master key) is checked, the server issues its own
// short-lived cookie. The browser can't read it (HttpOnly) or forge it (signed
// with SESSION_SECRET), so the role in it is the role the server trusts.

import { SignJWT, jwtVerify } from "jose";

export type Role = "student" | "trainer" | "admin";
export type SignInMethod = "hub" | "master";

export interface Session {
  email: string;
  name: string;
  batch: string;
  role: Role;
  via: SignInMethod;
}

export const SESSION_COOKIE = "bk_session";
const COOKIE_PATH = "/api";
const ISSUER = "blinkit-sim";
const ALGORITHM = "HS256";
const HOUR_SECONDS = 60 * 60;
/** A class session plus slack; students relaunch from the hub next time. */
export const HUB_SESSION_SECONDS = 12 * HOUR_SECONDS;
/** Master sign-in is staff-only and kept longer so staff aren't locked out mid-week. */
export const MASTER_SESSION_SECONDS = 30 * 24 * HOUR_SECONDS;

const ROLES: readonly Role[] = ["student", "trainer", "admin"];
const METHODS: readonly SignInMethod[] = ["hub", "master"];

export const isStaff = (session: Session | null): boolean => session?.role === "trainer" || session?.role === "admin";
export const isAdmin = (session: Session | null): boolean => session?.role === "admin";

const keyOf = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(session: Session, secret: string, ttlSeconds: number): Promise<string> {
  return new SignJWT({ name: session.name, batch: session.batch, role: session.role, via: session.via })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(session.email)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(keyOf(secret));
}

/** The session in a cookie value, or null when it is missing, expired, forged or malformed. */
export async function verifySession(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), { issuer: ISSUER, algorithms: [ALGORITHM] });
    const { sub, name, batch, role, via } = payload;
    if (typeof sub !== "string" || !sub) return null;
    if (typeof name !== "string" || typeof batch !== "string") return null;
    if (!ROLES.includes(role as Role) || !METHODS.includes(via as SignInMethod)) return null;
    return { email: sub, name, batch, role: role as Role, via: via as SignInMethod };
  } catch {
    return null;
  }
}

/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearedSessionCookie(secure: boolean): string {
  return sessionCookie("", 0, secure);
}
