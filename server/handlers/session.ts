// ── /api/session: sign in, check who is signed in, sign out ──────────────────
//   GET                     → the current session, or null
//   POST { token }          → check a hub launch token, set the session cookie
//   POST { masterKey }      → emergency staff sign-in (only if MASTER_KEY is set)
//   DELETE                  → sign out

import type { HandlerContext } from "../context.js";
import { badRequest, fail, methodNotAllowed, ok, type ApiRequest, type ApiResult } from "../http.js";
import { HubTokenError, verifyHubToken, type HubIdentity } from "../hubToken.js";
import { FailureLimiter, masterKeyMatches } from "../masterKey.js";
import {
  HUB_SESSION_SECONDS, MASTER_SESSION_SECONDS, clearedSessionCookie, sessionCookie, signSession, type Session,
} from "../session.js";
import { firstIssue, hubSignInSchema, masterSignInSchema } from "../validate.js";

export type HubVerifier = (token: string, hubUrl: string) => Promise<HubIdentity>;

export const MASTER_IDENTITY = { email: "master-access", name: "Master access", batch: "MASTER" } as const;

const masterFailures = new FailureLimiter();

/** What the browser is told about a session. */
const describe = (s: Session) => ({ email: s.email, name: s.name, batch: s.batch, role: s.role, via: s.via });

async function issue(session: Session, ttl: number, ctx: HandlerContext): Promise<ApiResult> {
  const token = await signSession(session, ctx.config.sessionSecret, ttl);
  return ok(describe(session), sessionCookie(token, ttl, ctx.config.secureCookies));
}

async function hubSignIn(token: string, ctx: HandlerContext, verify: HubVerifier): Promise<ApiResult> {
  try {
    const identity = await verify(token, ctx.config.hubUrl);
    return issue({ ...identity, via: "hub" }, HUB_SESSION_SECONDS, ctx);
  } catch (err) {
    if (!(err instanceof HubTokenError)) throw err;
    console.warn("[session] hub token rejected", err.kind, err.detail);
    const status = err.kind === "timeout" ? 504 : 401;
    return fail(status, err.kind, "The launch link couldn't be verified.", undefined);
  }
}

async function masterSignIn(key: string, ctx: HandlerContext, limiter: FailureLimiter): Promise<ApiResult> {
  if (limiter.isBlocked(ctx.clientId)) return fail(429, "too_many_attempts", "Too many tries. Wait 15 minutes.");
  if (!masterKeyMatches(key, ctx.config.masterKey)) {
    limiter.recordFailure(ctx.clientId);
    console.warn("[session] master key rejected", ctx.clientId);
    return fail(401, "bad_key", "That key isn't right.");
  }
  return issue({ ...MASTER_IDENTITY, role: "admin", via: "master" }, MASTER_SESSION_SECONDS, ctx);
}

export async function handleSession(
  req: ApiRequest,
  ctx: HandlerContext,
  verify: HubVerifier = verifyHubToken,
  limiter: FailureLimiter = masterFailures,
): Promise<ApiResult> {
  switch (req.method) {
    case "GET":
      return ok(ctx.session ? describe(ctx.session) : null);
    case "DELETE":
      return ok(null, clearedSessionCookie(ctx.config.secureCookies));
    case "POST": {
      const hub = hubSignInSchema.safeParse(req.body);
      if (hub.success) return hubSignIn(hub.data.token, ctx, verify);
      const master = masterSignInSchema.safeParse(req.body);
      if (master.success) return masterSignIn(master.data.masterKey, ctx, limiter);
      return badRequest(firstIssue(hub.error));
    }
    default:
      return methodNotAllowed();
  }
}
