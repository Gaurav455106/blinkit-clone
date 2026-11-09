// ── Signing in and out through the server ─────────────────────────────────────

import { api } from "@/lib/api";

export type SessionRole = "student" | "trainer" | "admin";

export interface SessionInfo {
  email: string;
  name: string;
  batch: string;
  role: SessionRole;
  via: "hub" | "master";
}

/** Sends the hub launch token to the server, which checks it and sets the session cookie. */
export const signInWithHub = (token: string) => api<SessionInfo>("POST", "/api/session", { body: { token } });

/** Emergency staff sign-in; the key is checked on the server. */
export const signInWithMasterKey = (masterKey: string) => api<SessionInfo>("POST", "/api/session", { body: { masterKey } });

/** The signed-in session, or null. */
export const currentSession = () => api<SessionInfo | null>("GET", "/api/session");

/** Clears the session cookie. Logged, never thrown: signing out locally must always work. */
export async function signOutOfServer(): Promise<void> {
  try {
    await api<null>("DELETE", "/api/session");
  } catch (err) {
    console.warn("[session] server sign-out failed", err);
  }
}
