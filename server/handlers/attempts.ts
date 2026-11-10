// ── /api/attempts: a student's saved runs ─────────────────────────────────────
//   GET  ?email=…[&touch=1][&limit=&offset=] → one page of that student's attempts, newest first
//   POST { attempt, runId }   → save a finished run, exactly once
//
// Students can only read and write their own email. Staff can do both for any
// email, which is how "Student view" test runs and staff profiles work.

import type { HandlerContext } from "../context.js";
import { badRequest, forbidden, methodNotAllowed, ok, unauthenticated, type ApiRequest, type ApiResult } from "../http.js";
import { isStaff, type Session } from "../session.js";
import { TEST_BATCH, refuseRealStudentEmail } from "../testRuns.js";
import type { AttemptInsert, Json } from "../store.js";
import { firstIssue, pageOf, saveAttemptSchema, storedEmail, type AttemptInput } from "../validate.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Students get their own identity forced in; staff keep their test identity, always in the test batch. */
function ownedBy(session: Session, attempt: AttemptInput): AttemptInput {
  if (isStaff(session)) return { ...attempt, batch_code: TEST_BATCH };
  return { ...attempt, email: session.email, name: session.name, batch_code: session.batch };
}

/**
 * score_total is an integer column but v2 totals carry one decimal (56.5), so
 * it is rounded; score_breakdown keeps the exact total. The run id goes into
 * choices.runId, where a unique index stops a second save of the same run.
 */
export function toAttemptRow(attempt: AttemptInput, runId: string): AttemptInsert {
  const choices = isRecord(attempt.choices) ? attempt.choices : {};
  return {
    ...attempt,
    score_total: Math.round(attempt.score_total),
    choices: { ...choices, runId } as Json,
    scenario: attempt.scenario as Json | undefined,
    score_breakdown: attempt.score_breakdown as Json | undefined,
    snapshot: attempt.snapshot as Json | null | undefined,
  };
}

async function listAttempts(req: ApiRequest, session: Session, ctx: HandlerContext): Promise<ApiResult> {
  const requested = storedEmail(req.query.email);
  if (!requested) return badRequest("email is required");
  if (!isStaff(session) && requested.trim().toLowerCase() !== session.email) return forbidden();
  // Staff look up exactly what they asked for; students always get their own rows
  const email = isStaff(session) ? requested : session.email;

  if (req.query.touch === "1") {
    // Best-effort: a failed "last seen" bump must not stop the student loading their runs
    await ctx.store.touchAttempts(email, ctx.now().toISOString()).catch((err: unknown) => {
      console.warn("[attempts] last_seen_at update failed", err);
    });
  }
  return ok(await ctx.store.attemptsByEmail(email, pageOf(req.query)));
}

async function saveAttempt(req: ApiRequest, session: Session, ctx: HandlerContext): Promise<ApiResult> {
  const parsed = saveAttemptSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(firstIssue(parsed.error));

  const attempt = ownedBy(session, parsed.data.attempt);
  if (isStaff(session)) {
    const refused = await refuseRealStudentEmail(attempt.email, ctx);
    if (refused) return refused;
  }
  const outcome = await ctx.store.insertAttempt(toAttemptRow(attempt, parsed.data.runId));

  // The live-run row goes only once the permanent record exists, and only for this run
  await ctx.store.deleteRunSession(attempt.email, parsed.data.runId).catch((err: unknown) => {
    console.warn("[attempts] run_sessions delete failed", err);
  });
  return ok({ outcome });
}

export async function handleAttempts(req: ApiRequest, ctx: HandlerContext): Promise<ApiResult> {
  const { session } = ctx;
  if (!session) return unauthenticated();
  if (req.method === "GET") return listAttempts(req, session, ctx);
  if (req.method === "POST") return saveAttempt(req, session, ctx);
  return methodNotAllowed();
}
