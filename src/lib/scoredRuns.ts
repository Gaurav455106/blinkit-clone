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

/** The id a saved attempt is listed under: the run it came from, so it matches this browser's entry. */
export function historyIdOf(attempt: { id: string; choices?: unknown }): string {
  const runId = (attempt.choices as { runId?: unknown } | null | undefined)?.runId;
  return typeof runId === "string" && runId ? runId : attempt.id;
}

/**
 * A snapshot the brief can be rebuilt from. Saved attempts only keep a cut-down
 * copy (seed and brand name), which can't be reviewed.
 */
export function isFullSnapshot(snapshot: unknown): boolean {
  const scenario = (snapshot as { scenario?: { cityStockMap?: unknown } } | null | undefined)?.scenario;
  return !!scenario && typeof scenario.cityStockMap === "object" && scenario.cityStockMap !== null;
}

interface HistoryEntry extends WithStatus {
  snapshot?: unknown;
}

/**
 * Cloud history merged into this browser's: one entry per run. The cloud's
 * saved result (status, score, date) wins, but a full local snapshot is kept
 * over the cloud's cut-down one so the run can still be reviewed here.
 * Local-only runs are kept, except "in progress" ones the cloud has scored.
 */
export function mergeRunHistory<T extends HistoryEntry>(local: readonly T[], cloud: readonly T[]): T[] {
  const localById = new Map(local.map((r) => [r.id, r]));
  const merged = cloud.map((c) => {
    const mine = localById.get(c.id);
    return mine && isFullSnapshot(mine.snapshot) ? { ...c, snapshot: mine.snapshot } : c;
  });
  const cloudIds = new Set(cloud.map((c) => c.id));
  return [...merged, ...local.filter((r) => !cloudIds.has(r.id))];
}
