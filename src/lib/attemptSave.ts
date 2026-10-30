// ── Saving a finished run to `attempts`, exactly once ─────────────────────────
// Both results pages (v1 Day30Results, v2 DebriefV2) save through here.
//   - The run id goes into choices.runId. A unique index on it (migration
//     20261030090000) makes a second insert of the same run fail with 23505,
//     which counts as "already saved", so re-opening the results page can't
//     duplicate a score.
//   - This browser remembers which runs are saved, and only after the insert
//     succeeds, so a failed save is retried on the next visit.
//   - score_total is an integer column but v2 totals carry one decimal (56.5),
//     which Postgres rejects, so it is rounded here; score_breakdown keeps the
//     exact total.
//   - The live-run row is removed only after the permanent record exists, and
//     only for this run, so a newer run in progress isn't wiped.

import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

const SAVED_RUNS_KEY = "sim_saved_attempt_runs";
const UNIQUE_VIOLATION = "23505";
const MAX_REMEMBERED_RUNS = 200;

export type SaveOutcome = "saved" | "already_saved";

function savedRuns(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAVED_RUNS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** True once this browser has confirmed the run's attempt is in the database. */
export function isRunSaved(runId: string | null): boolean {
  return !!runId && savedRuns().includes(runId);
}

function markRunSaved(runId: string): void {
  try {
    const next = [...savedRuns().filter((id) => id !== runId), runId].slice(-MAX_REMEMBERED_RUNS);
    window.localStorage.setItem(SAVED_RUNS_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the unique index still stops a duplicate row
  }
}

function withRunId(choices: Json | undefined, runId: string): Json {
  const base = choices && typeof choices === "object" && !Array.isArray(choices) ? choices : {};
  return { ...base, runId };
}

/** Inserts the attempt for `runId`; throws the Supabase error when the save fails. */
export async function saveAttempt(row: TablesInsert<"attempts">, runId: string): Promise<SaveOutcome> {
  const { error } = await supabase.from("attempts").insert({
    ...row,
    score_total: Math.round(row.score_total),
    choices: withRunId(row.choices, runId),
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
  markRunSaved(runId);

  const { error: sessionError } = await supabase.from("run_sessions").delete().eq("email", row.email).eq("run_id", runId);
  if (sessionError) console.warn("[sim] run_sessions delete failed", sessionError);
  return error ? "already_saved" : "saved";
}
