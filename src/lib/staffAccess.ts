// ── Who may open the Trainer and Admin pages ─────────────────────────────────
// Decided from the server session, not from the role remembered in this
// browser: a browser signed in before the server sign-in existed still says
// "admin" locally but has no session, and would otherwise see empty pages.

import type { SessionInfo, SessionRole } from "@/lib/session";

/** allow: show the page · home: signed in, wrong role · login: master key page · hub: sign in via the hub */
export type StaffAccess = "allow" | "home" | "login" | "hub";

export function staffAccess(
  session: SessionInfo | null,
  allowed: readonly SessionRole[],
  masterRemembered: boolean,
): StaffAccess {
  if (session) return allowed.includes(session.role) ? "allow" : "home";
  return masterRemembered ? "login" : "hub";
}

/** Browser-side role markers from the old sign-in; cleared when the server has no session. */
export const LOCAL_ROLE_KEYS = ["sim_role", "sim_trainer"] as const;

export function forgetLocalRole(): void {
  for (const key of LOCAL_ROLE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* storage blocked */ }
  }
}
