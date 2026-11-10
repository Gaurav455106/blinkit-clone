// ── Checking the Kraftshala Hub launch token on the server ───────────────────
// The hub signs a JWT for each launch; we check it against the hub's public
// key. Moving this off the browser means nobody can skip it.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Role } from "./session.js";

export const SIM_SLUG = "blinkit-sim";
/** Falls back to this when the hub sends neither batch nor course. */
export const DEFAULT_BATCH = "HUB";

export interface HubIdentity {
  name: string;
  email: string;
  batch: string;
  role: Role;
}

export type HubFailure = "timeout" | "expired" | "invalid" | "unknown_role";

export class HubTokenError extends Error {
  constructor(readonly kind: HubFailure, readonly detail?: string) {
    super(kind);
  }
}

const ROLE_BY_HUB_ROLE: Record<string, Role> = {
  super_admin: "admin",
  instructor: "trainer",
  student: "student",
};

const jwksByHub = new Map<string, JWTVerifyGetKey>();

/**
 * The hub's public keys, cached per warm server instance. The hub's JWKS route
 * is serverless too, so a cold start can be slow; the browser retries once on
 * a timeout.
 */
export function hubKeys(hubUrl: string): JWTVerifyGetKey {
  const cached = jwksByHub.get(hubUrl);
  if (cached) return cached;
  const keys = createRemoteJWKSet(new URL(`${hubUrl}/.well-known/jwks.json`), {
    timeoutDuration: 8_000,
    cooldownDuration: 2_000,
    cacheMaxAge: 600_000,
  });
  jwksByHub.set(hubUrl, keys);
  return keys;
}

const codeOf = (err: unknown): string => (err as { code?: string })?.code ?? "";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Checks a hub launch token and returns who it is for; throws HubTokenError. */
export async function verifyHubToken(token: string, hubUrl: string, keys: JWTVerifyGetKey = hubKeys(hubUrl)): Promise<HubIdentity> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, keys, { issuer: hubUrl, audience: SIM_SLUG }));
  } catch (err) {
    const code = codeOf(err);
    if (code === "ERR_JWKS_TIMEOUT" || code === "ERR_JWKS_NO_MATCHING_KEY") throw new HubTokenError("timeout", code);
    if (code === "ERR_JWT_EXPIRED") throw new HubTokenError("expired", code);
    throw new HubTokenError("invalid", code || "unknown");
  }

  const hubRole = text(payload.sim_role);
  const role = ROLE_BY_HUB_ROLE[hubRole];
  if (!role) throw new HubTokenError("unknown_role", hubRole || "missing");

  const email = text(payload.email).toLowerCase();
  if (!email) throw new HubTokenError("invalid", "missing_email");

  return {
    role,
    email,
    name: text(payload.name) || email,
    batch: text(payload.batch) || text(payload.course) || DEFAULT_BATCH,
  };
}
