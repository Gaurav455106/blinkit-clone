// A run whose score is saved is finished, even if this browser still lists it
// as "in progress" (a leftover from before finished runs stopped being
// restored). Saved attempts are listed by attempt id, and the run they came
// from is in choices.runId, so the two have to be matched by that.

interface WithStatus {
  id: string;
  status: string;
}

/** Run ids that already have a saved attempt. */
export function scoredRunIds(attempts: readonly { choices?: unknown }[]): Set<string> {
  const ids = attempts
    .map((a) => (a.choices as { runId?: unknown } | null | undefined)?.runId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return new Set(ids);
}

/** History without "in progress" entries whose run is already scored (same list if none). */
export function dropScoredInProgress<T extends WithStatus>(history: T[], scored: ReadonlySet<string>): T[] {
  const kept = history.filter((r) => !(r.status === "in_progress" && scored.has(r.id)));
  return kept.length === history.length ? history : kept;
}
