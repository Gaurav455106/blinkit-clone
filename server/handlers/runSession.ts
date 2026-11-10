// ── /api/run-session: the live copy of a run in progress ─────────────────────
//   GET ?email=…                                               → that student's row, or null
//   PUT { email, name, batch_code, run_id, started_at, state } → upsert, one row per email
//
// A run whose score is already saved is finished: its live copy is dropped
// rather than stored or restored, so it can't come back as the active run.
//
// Students can only read and write their own row; staff can for any email
// (Student view test identities).

import type { HandlerContext } from "../context.js";
import { badRequest, forbidden, methodNotAllowed, ok, unauthenticated, type ApiRequest, type ApiResult } from "../http.js";
import { isStaff, type Session } from "../session.js";
import type { Json } from "../store.js";
import { firstIssue, runSessionSchema, storedEmail } from "../validate.js";

function validDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const time = Date.parse(value);
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

async function readRunSession(req: ApiRequest, session: Session, ctx: HandlerContext): Promise<ApiResult> {
  const requested = storedEmail(req.query.email);
  if (!requested) return badRequest("email is required");
  if (!isStaff(session) && requested.trim().toLowerCase() !== session.email) return forbidden();
  const email = isStaff(session) ? requested : session.email;
  const row = await ctx.store.runSessionByEmail(email);
  // A finished run's leftover copy must not come back as the active run
  if (row && await ctx.store.runIsSaved(row.run_id)) {
    await ctx.store.deleteRunSession(email, row.run_id);
    return ok(null);
  }
  return ok(row);
}

async function writeRunSession(req: ApiRequest, session: Session, ctx: HandlerContext): Promise<ApiResult> {
  const parsed = runSessionSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(firstIssue(parsed.error));
  const input = parsed.data;
  const now = ctx.now().toISOString();
  const owner = isStaff(session)
    ? { email: input.email, name: input.name, batch_code: input.batch_code }
    : { email: session.email, name: session.name, batch_code: session.batch };

  // Its score is saved, so this is a late auto-save of a finished run: drop it, don't store it
  if (await ctx.store.runIsSaved(input.run_id)) {
    await ctx.store.deleteRunSession(owner.email, input.run_id);
    return ok(null);
  }

  await ctx.store.upsertRunSession({
    ...owner,
    run_id: input.run_id,
    state: input.state as Json,
    started_at: validDate(input.started_at, now),
    last_seen_at: now,
  });
  return ok(null);
}

export async function handleRunSession(req: ApiRequest, ctx: HandlerContext): Promise<ApiResult> {
  const { session } = ctx;
  if (!session) return unauthenticated();
  if (req.method === "GET") return readRunSession(req, session, ctx);
  if (req.method === "PUT") return writeRunSession(req, session, ctx);
  return methodNotAllowed();
}
