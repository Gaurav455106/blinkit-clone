// ── /api/staff: trainer and admin reads ──────────────────────────────────────
//   GET ?view=attempts[&limit=&offset=] → one page of saved attempts, newest first
//   GET ?view=live               → live (unfinished) runs, without the big state JSON
//   GET ?view=stale-count&days=N → live rows not seen for N days

import type { HandlerContext } from "../context.js";
import { badRequest, forbidden, methodNotAllowed, ok, unauthenticated, type ApiRequest, type ApiResult } from "../http.js";
import { isStaff } from "../session.js";
import { boundedInt, pageOf } from "../validate.js";

export const LIVE_SESSION_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_DAYS = { fallback: 7, min: 1, max: 365 } as const;

export function staleCutoff(daysParam: string | undefined, now: Date): string {
  const days = boundedInt(daysParam, STALE_DAYS.fallback, STALE_DAYS.min, STALE_DAYS.max);
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export async function handleStaff(req: ApiRequest, ctx: HandlerContext): Promise<ApiResult> {
  if (!ctx.session) return unauthenticated();
  if (!isStaff(ctx.session)) return forbidden();
  if (req.method !== "GET") return methodNotAllowed();

  switch (req.query.view) {
    case "attempts":
      return ok(await ctx.store.allAttempts(pageOf(req.query)));
    case "live":
      return ok(await ctx.store.liveSessions(LIVE_SESSION_LIMIT));
    case "stale-count":
      return ok({ count: await ctx.store.countSessionsSeenBefore(staleCutoff(req.query.days, ctx.now())) });
    default:
      return badRequest("view must be attempts, live or stale-count");
  }
}
