// ── Staff test runs (Student view) ────────────────────────────────────────────
// Staff play the sim under a test identity. Their runs are kept in one batch so
// they never mix with real students' scores, and they can't be saved under a
// real student's email (which would also overwrite that student's live run).

import type { HandlerContext } from "./context.js";
import { fail, type ApiResult } from "./http.js";

/** The batch every staff-made run is saved in; left out of the leaderboard. */
export const TEST_BATCH = "MASTER";

/**
 * Null when staff may use this test email, or the 409 to return when it
 * belongs to a real student (one with runs outside the test batch).
 */
export async function refuseRealStudentEmail(email: string, ctx: HandlerContext): Promise<ApiResult | null> {
  if (!(await ctx.store.isRealStudent(email))) return null;
  return fail(409, "real_student", "That email belongs to a student. Use a test email in Student view.");
}
