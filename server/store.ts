// ── Every database read and write the API makes ───────────────────────────────
// Handlers depend on the Store interface, so tests use an in-memory copy and
// only supabaseStore talks to Postgres (with the service-role key, server-side).

import { TEST_BATCH } from "./testRuns.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/integrations/supabase/types.js";

type AttemptInsert = Database["public"]["Tables"]["attempts"]["Insert"];
type RunSessionInsert = Database["public"]["Tables"]["run_sessions"]["Insert"];
type AttemptRow = Database["public"]["Tables"]["attempts"]["Row"];
type RunSessionRow = Database["public"]["Tables"]["run_sessions"]["Row"];

export type { AttemptInsert, RunSessionInsert, AttemptRow, RunSessionRow, Json };

export type SaveResult = "saved" | "already_saved";

/** The leaderboard needs these, never the large snapshot or choices. */
export const LEADERBOARD_COLUMNS = "id,email,name,batch_code,score_total,badge,profile_id,score_breakdown,created_at";
export type LeaderboardAttempt = Pick<AttemptRow, "id" | "email" | "name" | "batch_code" | "score_total" | "badge" | "profile_id" | "score_breakdown" | "created_at">;

/** The columns the staff "Live now" tab reads, with JSON paths flattened. Keeps `state` off the wire. */
export const LIVE_SESSION_COLUMNS = [
  "email", "name", "batch_code", "run_id", "started_at", "last_seen_at",
  "brand:state->scenario->profile->>name",
  "engine:state->scenario->>engine",
  "has_pitch:state->cmPitch",
  "has_deal:state->openingDeal",
  "v2_days:state->v2Run->daysDone",
  "v1_day:state->currentDay",
].join(",");

/** One page of rows. Lists are paged because Vercel caps a response at 4.5 MB. */
export interface Page {
  limit: number;
  offset: number;
}

export interface Store {
  insertAttempt(row: AttemptInsert): Promise<SaveResult>;
  attemptsByEmail(email: string, page: Page): Promise<AttemptRow[]>;
  touchAttempts(email: string, at: string): Promise<void>;
  allAttempts(page: Page): Promise<AttemptRow[]>;
  leaderboardAttempts(page: Page): Promise<LeaderboardAttempt[]>;
  batchScores(limit: number): Promise<{ batch_code: string; score_total: number }[]>;
  upsertRunSession(row: RunSessionInsert): Promise<void>;
  runSessionByEmail(email: string): Promise<RunSessionRow | null>;
  deleteRunSession(email: string, runId: string): Promise<void>;
  /** True when a saved attempt already exists for this run (unique on choices.runId). */
  runIsSaved(runId: string): Promise<boolean>;
  /** True when this email has runs outside the staff test batch (a real student). */
  isRealStudent(email: string): Promise<boolean>;
  liveSessions(limit: number): Promise<unknown[]>;
  countSessionsSeenBefore(cutoff: string): Promise<number>;
  deleteSessionsSeenBefore(cutoff: string): Promise<void>;
  deleteAttemptsByEmail(email: string): Promise<void>;
  deleteAttemptsByBatch(batch: string): Promise<void>;
  deleteRunSessionsByBatch(batch: string): Promise<void>;
}

const UNIQUE_VIOLATION = "23505";

/** A database error with the Postgres code kept, logged server-side only. */
export class StoreError extends Error {
  constructor(readonly operation: string, readonly code: string | undefined, message: string) {
    super(`${operation}: ${message}`);
  }
}

function check<T>(operation: string, result: { data: T | null; error: { code?: string; message: string } | null }): T {
  if (result.error) throw new StoreError(operation, result.error.code, result.error.message);
  return result.data as T;
}

export function supabaseStore(url: string, serviceKey: string): Store {
  const db: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async insertAttempt(row) {
      const { error } = await db.from("attempts").insert(row);
      if (!error) return "saved";
      if (error.code === UNIQUE_VIOLATION) return "already_saved";
      throw new StoreError("insertAttempt", error.code, error.message);
    },
    async attemptsByEmail(email, page) {
      const query = db.from("attempts").select("*").eq("email", email)
        .order("created_at", { ascending: false }).order("id", { ascending: true });
      return check("attemptsByEmail", await query.range(page.offset, page.offset + page.limit - 1)) ?? [];
    },
    async touchAttempts(email, at) {
      check("touchAttempts", await db.from("attempts").update({ last_seen_at: at }).eq("email", email));
    },
    async allAttempts(page) {
      const query = db.from("attempts").select("*")
        .order("created_at", { ascending: false }).order("id", { ascending: true });
      return check("allAttempts", await query.range(page.offset, page.offset + page.limit - 1)) ?? [];
    },
    async leaderboardAttempts(page) {
      // id breaks ties so equal scores can't repeat or go missing between pages
      // New-simulation (v2) runs only, without staff test runs: one scoring scheme per board
      const query = db.from("attempts").select(LEADERBOARD_COLUMNS)
        .neq("batch_code", TEST_BATCH).eq("score_breakdown->>version", "2")
        .order("score_total", { ascending: false }).order("id", { ascending: true });
      const result = await query.range(page.offset, page.offset + page.limit - 1);
      return (check("leaderboardAttempts", result) ?? []) as unknown as LeaderboardAttempt[];
    },
    async batchScores(limit) {
      // From the same rows as the leaderboard (batch_scores copies every attempt, test and v1 included)
      return check("batchScores", await db.from("attempts").select("batch_code,score_total")
        .neq("batch_code", TEST_BATCH).eq("score_breakdown->>version", "2").limit(limit)) ?? [];
    },
    async upsertRunSession(row) {
      check("upsertRunSession", await db.from("run_sessions").upsert(row, { onConflict: "email" }));
    },
    async runSessionByEmail(email) {
      return check("runSessionByEmail", await db.from("run_sessions").select("*").eq("email", email).maybeSingle());
    },
    async isRealStudent(email) {
      const saved = check("isRealStudent", await db.from("attempts").select("id").eq("email", email).neq("batch_code", TEST_BATCH).limit(1));
      if ((saved ?? []).length > 0) return true;
      const live = check("isRealStudent", await db.from("run_sessions").select("email").eq("email", email).neq("batch_code", TEST_BATCH).limit(1));
      return (live ?? []).length > 0;
    },
    async runIsSaved(runId) {
      const rows = check("runIsSaved", await db.from("attempts").select("id").eq("choices->>runId", runId).limit(1));
      return (rows ?? []).length > 0;
    },
    async deleteRunSession(email, runId) {
      check("deleteRunSession", await db.from("run_sessions").delete().eq("email", email).eq("run_id", runId));
    },
    async liveSessions(limit) {
      const result = await db.from("run_sessions").select(LIVE_SESSION_COLUMNS).order("last_seen_at", { ascending: false }).limit(limit);
      return (check("liveSessions", result) ?? []) as unknown[];
    },
    async countSessionsSeenBefore(cutoff) {
      const { count, error } = await db.from("run_sessions").select("*", { count: "exact", head: true }).lt("last_seen_at", cutoff);
      if (error) throw new StoreError("countSessionsSeenBefore", error.code, error.message);
      return count ?? 0;
    },
    async deleteSessionsSeenBefore(cutoff) {
      check("deleteSessionsSeenBefore", await db.from("run_sessions").delete().lt("last_seen_at", cutoff));
    },
    async deleteAttemptsByEmail(email) {
      check("deleteAttemptsByEmail", await db.from("attempts").delete().eq("email", email));
    },
    async deleteAttemptsByBatch(batch) {
      check("deleteAttemptsByBatch", await db.from("attempts").delete().eq("batch_code", batch));
    },
    async deleteRunSessionsByBatch(batch) {
      check("deleteRunSessionsByBatch", await db.from("run_sessions").delete().eq("batch_code", batch));
    },
  };
}
