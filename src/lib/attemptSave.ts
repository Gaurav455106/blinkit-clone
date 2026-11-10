// ── Saving a finished run to `attempts`, exactly once ─────────────────────────
// Both results pages (v1 Day30Results, v2 DebriefV2) save through here.
//   - The run id goes into choices.runId. A unique index on it (migration
//     20261030090000) makes a second insert of the same run fail with 23505,
//     which counts as "already saved", so re-opening the results page can't
//     duplicate a score.
//   - This browser remembers which runs are saved, and only after the insert
//     succeeds, so a failed save is retried on the next visit.
//   - The save goes through /api/attempts. The server checks the session,
//     forces a student's own email, rounds score_total (an integer column; v2
//     totals carry one decimal, and score_breakdown keeps the exact total), and
//     stamps choices.runId.
//   - The server removes the live-run row only after the permanent record
//     exists, and only for this run, so a newer run in progress isn't wiped.

import { api } from "@/lib/api";
import type { TablesInsert } from "@/integrations/supabase/types";

const SAVED_RUNS_KEY = "sim_saved_attempt_runs";
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

/** Saves the attempt for `runId`; throws ApiError when the save fails. */
export async function saveAttempt(row: TablesInsert<"attempts">, runId: string): Promise<SaveOutcome> {
  const { outcome } = await api<{ outcome: SaveOutcome }>("POST", "/api/attempts", { body: { attempt: row, runId } });
  markRunSaved(runId);
  return outcome;
}
