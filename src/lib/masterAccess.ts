/**
 * masterAccess.ts — single source of truth for the Kraftshala Hub origin and the
 * sticky master-access flag.
 *
 * Why this file exists: HUB_URL used to be hardcoded separately in SSOCallback,
 * App and Login. When the hub moved to a new domain, one copy was missed and SSO
 * broke. Everything now imports from here so the URL can only ever be wrong once.
 *
 * HUB_URL must stay the bare ORIGIN — it doubles as the JWT `issuer` claim and as
 * the base for `{HUB_URL}/.well-known/jwks.json`. Appending a path (e.g. /admin)
 * breaks both.
 */

export const HUB_URL = "https://ksstudentshub.vercel.app";

/** Internal bypass key. Frontend-only, so it deters casual access — not a secret. */
const MASTER_KEY  = "gaurav2024";
const MASTER_FLAG = "sim_master";

/** localStorage marker for which student currently owns this browser's session. */
export const ACTIVE_EMAIL_KEY = "sim_active_email";

/** Safe localStorage access — can throw in private mode / blocked-storage contexts. */
function readFlag(): boolean {
  try { return localStorage.getItem(MASTER_FLAG) === "1"; } catch { return false; }
}

/**
 * True if this browser has previously unlocked master access.
 *
 * Deliberately sticky: nothing in the app clears it — not `reset()`, not either
 * signOut handler — so unlocking once on your own machine is permanent and you
 * never have to remember the master URL again.
 */
export function hasMasterAccess(): boolean {
  return readFlag();
}

/**
 * Reads `?master=` from the current URL, persists or clears the sticky flag, and
 * returns whether master access is active. Call this on page load.
 *
 *   ?master=<key>  → unlock permanently on this browser
 *   ?master=off    → clear it (for cleaning up a shared/training machine)
 *   (absent)       → fall back to whatever was previously stored
 */
export function syncMasterFlag(): boolean {
  let param: string | null = null;
  try { param = new URLSearchParams(window.location.search).get("master"); } catch { /* ignore */ }

  if (param === MASTER_KEY) {
    try { localStorage.setItem(MASTER_FLAG, "1"); } catch { /* ignore */ }
    return true;
  }
  if (param === "off") {
    try { localStorage.removeItem(MASTER_FLAG); } catch { /* ignore */ }
    return false;
  }
  return readFlag();
}
