/**
 * masterAccess.ts — single source of truth for the Kraftshala Hub origin and the
 * sticky master-access flag. The master key itself lives only on the server.
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

const MASTER_FLAG = "sim_master";
const MASTER_PARAM = "master";
const MASTER_OFF = "off";

/** localStorage marker for which student currently owns this browser's session. */
export const ACTIVE_EMAIL_KEY = "sim_active_email";

/** Safe localStorage access — can throw in private mode / blocked-storage contexts. */
function readFlag(): boolean {
  try { return localStorage.getItem(MASTER_FLAG) === "1"; } catch { return false; }
}

/**
 * True if this browser has unlocked master access before. This only decides
 * whether the staff role picker is shown: the key itself is checked on the
 * server (MASTER_KEY env var), and every data request needs the session
 * cookie the server sets, so editing this flag unlocks nothing.
 *
 * Deliberately sticky: nothing in the app clears it — not `reset()`, not either
 * signOut handler — so staff don't have to re-enter the key on their own machine.
 */
export function hasMasterAccess(): boolean {
  return readFlag();
}

export function setMasterFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(MASTER_FLAG, "1");
    else localStorage.removeItem(MASTER_FLAG);
  } catch { /* storage blocked */ }
}

export type MasterParam = { kind: "unlock"; key: string } | { kind: "off" } | null;

/**
 * Reads `?master=` from the current URL:
 *   ?master=<key>  → try to unlock (the server checks the key)
 *   ?master=off    → lock this browser again (for shared/training machines)
 */
export function readMasterParam(): MasterParam {
  let param: string | null = null;
  try { param = new URLSearchParams(window.location.search).get(MASTER_PARAM); } catch { /* ignore */ }
  if (!param) return null;
  return param === MASTER_OFF ? { kind: "off" } : { kind: "unlock", key: param };
}

/** Removes `?master=` from the address bar so the key isn't left in history or screenshots. */
export function stripMasterParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(MASTER_PARAM)) return;
    url.searchParams.delete(MASTER_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch { /* ignore */ }
}
