// ── /api/admin: deletes, admins only ─────────────────────────────────────────
//   DELETE ?target=student&email=…  → every attempt for that email
//   DELETE ?target=batch&batch=…    → every attempt in the batch, then its live rows
//   DELETE ?target=stale&days=N     → live rows not seen for N days (scores untouched)

import type { HandlerContext } from "../context.js";
import { badRequest, forbidden, methodNotAllowed, ok, unauthenticated, type ApiRequest, type ApiResult } from "../http.js";
import { isAdmin } from "../session.js";
import { storedEmail } from "../validate.js";
import { staleCutoff } from "./staff.js";

const MAX_BATCH_LENGTH = 200;

async function deleteStudent(email: string | undefined, ctx: HandlerContext): Promise<ApiResult> {
  // Exactly the email the admin picked from the table, so older rows in any format still match
  const target = storedEmail(email);
  if (!target) return badRequest("email is required");
  await ctx.store.deleteAttemptsByEmail(target);
  return ok(null);
}

async function deleteBatch(batch: string | undefined, ctx: HandlerContext): Promise<ApiResult> {
  if (!batch || !batch.trim() || batch.length > MAX_BATCH_LENGTH) return badRequest("batch is required");
  await ctx.store.deleteAttemptsByBatch(batch);
  // Best-effort, as before: stale live rows for the batch aren't worth failing on
  await ctx.store.deleteRunSessionsByBatch(batch).catch((err: unknown) => {
    console.warn("[admin] run_sessions batch delete failed", err);
  });
  return ok(null);
}

export async function handleAdmin(req: ApiRequest, ctx: HandlerContext): Promise<ApiResult> {
  if (!ctx.session) return unauthenticated();
  if (!isAdmin(ctx.session)) return forbidden();
  if (req.method !== "DELETE") return methodNotAllowed();

  switch (req.query.target) {
    case "student":
      return deleteStudent(req.query.email, ctx);
    case "batch":
      return deleteBatch(req.query.batch, ctx);
    case "stale":
      await ctx.store.deleteSessionsSeenBefore(staleCutoff(req.query.days, ctx.now()));
      return ok(null);
    default:
      return badRequest("target must be student, batch or stale");
  }
}
