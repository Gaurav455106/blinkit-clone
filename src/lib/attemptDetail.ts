// ── Per-student detail for the staff tables ───────────────────────────────────
// Small readers over one student's saved attempts: their run history, where a
// run lost the most points, and (v2) the costliest mistakes.

import type { SavedCampaign } from "@/context/SimContext";
import { attemptLines, attemptTotals, attemptVersion, latestFirst, oldestFirst, type AttemptRow } from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES } from "@/lib/rubrics";
import type { ObjectiveUnit } from "@/market/moments";

export interface LineLoss {
  key: string;
  label: string;
  lost: number;
  note: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Parts that lost points, for runs saved before line scores existed. */
function partLosses(row: AttemptRow): LineLoss[] {
  const totals = attemptTotals(row);
  if (!totals) return [];
  return SCORE_SCHEMES[attemptVersion(row)].map((c) => ({ key: c.key, label: c.label, lost: round1(c.max - (totals[c.key] ?? 0)), note: "" }));
}

/** The lines that lost the most points, biggest first; whole parts for runs saved without lines. */
export function topLosses(row: AttemptRow, limit = 3): LineLoss[] {
  const lines = attemptLines(row);
  const losses = lines
    ? lines.map((l) => ({ key: l.key, label: l.label, lost: round1(l.max - l.earned), note: l.note }))
    : partLosses(row);
  return losses
    .filter((l) => l.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, limit);
}

export interface SavedMistake {
  title: string;
  lost: number;
  what: string;
  /** Missing on attempts saved before units were recorded: those were ₹ or unlabelled. */
  unit?: ObjectiveUnit;
}

const UNITS: readonly ObjectiveUnit[] = ["₹", "units", "views", "reach points"];

/** The v2 costliest mistakes saved with the score, read defensively. */
export function costliestMistakesOf(row: AttemptRow): SavedMistake[] {
  const breakdown = row.score_breakdown;
  const raw = breakdown && typeof breakdown === "object" ? (breakdown as Record<string, unknown>).costliestMistakes : null;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m): SavedMistake[] => {
    if (!m || typeof m !== "object") return [];
    const o = m as Record<string, unknown>;
    if (typeof o.title !== "string" || typeof o.lost !== "number" || !Number.isFinite(o.lost)) return [];
    const unit = UNITS.find((u) => u === o.unit);
    return [{ title: o.title, lost: o.lost, what: typeof o.what === "string" ? o.what : "No action", ...(unit ? { unit } : {}) }];
  });
}

export interface RunHistory {
  runs: number;
  best: AttemptRow;
  latest: AttemptRow;
  /** Latest score minus the first run's score; 0 with one run. */
  change: number;
  /** Runs newest first. */
  ordered: AttemptRow[];
}

/** One student's runs summarised; null when there are none. */
export function runHistory(runs: readonly AttemptRow[]): RunHistory | null {
  if (runs.length === 0) return null;
  const ordered = latestFirst(runs);
  const first = oldestFirst(runs)[0];
  const best = runs.reduce((b, r) => (r.score_total > b.score_total || (r.score_total === b.score_total && r.created_at > b.created_at) ? r : b));
  return {
    runs: runs.length,
    best,
    latest: ordered[0],
    change: Math.round((ordered[0].score_total - first.score_total) * 10) / 10,
    ordered,
  };
}

/** Attempts grouped by email. */
export function runsByEmail(rows: readonly AttemptRow[]): ReadonlyMap<string, AttemptRow[]> {
  const map = new Map<string, AttemptRow[]>();
  for (const r of rows) map.set(r.email, [...(map.get(r.email) ?? []), r]);
  return map;
}

export type CampaignSnapshot = Omit<SavedCampaign, "wizardSnapshot" | "draftId" | "isDraft">;

/** Launched campaigns as saved with a v2 attempt: drafts and wizard state left out. */
export function snapshotCampaigns(campaigns: readonly SavedCampaign[]): CampaignSnapshot[] {
  return campaigns
    .filter((c) => !c.isDraft)
    .map(({ wizardSnapshot: _w, draftId: _d, isDraft: _i, ...rest }) => rest);
}
