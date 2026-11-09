// ── /api/leaderboard: best scores, for anyone signed in ──────────────────────
// Students see names and scores but not classmates' emails: each other email
// becomes a stable pseudonym, so grouping per student still works. Staff see
// real emails.

import { createHmac } from "node:crypto";
import type { HandlerContext } from "../context.js";
import { badRequest, methodNotAllowed, ok, unauthenticated, type ApiRequest, type ApiResult } from "../http.js";
import { isStaff } from "../session.js";
import type { LeaderboardAttempt } from "../store.js";
import { pageOf } from "../validate.js";

export const BATCH_SCORES_LIMIT = 5000;
const PSEUDONYM_LENGTH = 16;

export function pseudonym(email: string, secret: string): string {
  return "student-" + createHmac("sha256", secret).update(email).digest("hex").slice(0, PSEUDONYM_LENGTH);
}

export function maskEmails(rows: readonly LeaderboardAttempt[], viewerEmail: string, secret: string): LeaderboardAttempt[] {
  return rows.map((row) => (row.email === viewerEmail ? row : { ...row, email: pseudonym(row.email, secret) }));
}

/**
 *   GET ?view=attempts[&limit=&offset=] → one page of attempts, best score first
 *   GET ?view=batches                   → every batch score (two small columns)
 */
export async function handleLeaderboard(req: ApiRequest, ctx: HandlerContext): Promise<ApiResult> {
  const { session } = ctx;
  if (!session) return unauthenticated();
  if (req.method !== "GET") return methodNotAllowed();

  if (req.query.view === "batches") return ok(await ctx.store.batchScores(BATCH_SCORES_LIMIT));
  if (req.query.view !== "attempts") return badRequest("view must be attempts or batches");

  const attempts = await ctx.store.leaderboardAttempts(pageOf(req.query));
  // Staff (including in Student view) see real emails, so their own row still highlights
  return ok(isStaff(session) ? attempts : maskEmails(attempts, session.email, ctx.config.sessionSecret));
}
