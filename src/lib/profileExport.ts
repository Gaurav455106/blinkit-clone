// ── Student-profile and cohort Excel workbooks ───────────────────────────────
// Pure sheet builders over attempt rows (see attemptAnalysis.ts). Works for
// v1 and v2 attempts: category and line columns come from what each row has.

import type { Row, SheetSpec } from "@/lib/excel";
import {
  attemptLines, attemptTotals, attemptVersion, brandOf, gradeLabelOf, oldestFirst, strengthsAndGaps, lineStats, crisisStats,
  type AttemptRow,
} from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES, RUBRICS, categoryLabel, isRubricKey, type LineResult } from "@/lib/rubrics";
import { levelReached, type ReadmeRow } from "@/lib/resultsExport";

const dateOnly = (iso: string) => iso.slice(0, 10);

function categoryCells(row: AttemptRow): Row {
  const t = attemptTotals(row);
  return Object.fromEntries(SCORE_SCHEMES[attemptVersion(row)].map((c) => [c.label, t ? t[c.key] ?? null : null]));
}

function attemptBase(row: AttemptRow): Row {
  return {
    Date: dateOnly(row.created_at),
    Brand: brandOf(row),
    "Score version": attemptVersion(row),
    Total: row.score_total,
    Grade: gradeLabelOf(row),
    ...categoryCells(row),
    "Line detail saved": attemptLines(row) !== null,
  };
}

// ── Student profile ───────────────────────────────────────────────────────────

export const PROFILE_README: readonly ReadmeRow[] = [
  { column: "Attempts", meaning: "One row for each finished run, oldest first. The part columns are points. In version 1: Setup out of 35, Live optimisation out of 25, Crisis responses out of 25, Results out of 15." },
  { column: "Score version", meaning: "1 = the current scoring. 2 = the new scoring. Scores from different versions should not be compared directly." },
  { column: "Line detail saved", meaning: "FALSE for runs saved before we stored a score for each line. Those runs only have totals for each part." },
  { column: "Score lines", meaning: "One row for each scored line in each run. Points lost = Max minus Earned." },
  { column: "Strengths & gaps", meaning: "Strength: on average you got 80% or more of the points. Gap: you lost points on this line in more than half of your runs." },
];

function profileLineRows(rows: readonly AttemptRow[]): Row[] {
  return oldestFirst(rows).flatMap((r) => (attemptLines(r) ?? []).map((l) => ({
    Date: dateOnly(r.created_at),
    Brand: brandOf(r),
    Category: categoryLabel(l.category, attemptVersion(r)),
    Line: l.label,
    Earned: l.earned,
    Max: l.max,
    "Points lost": l.max - l.earned,
    "Level reached": levelReached(l),
    Reason: l.note,
  })));
}

function strengthGapRows(rows: readonly AttemptRow[]): Row[] {
  const { strengths, gaps } = strengthsAndGaps(rows);
  return [
    ...strengths.map((s) => ({ Type: "Strength", Line: s.label, "Average (% of max)": s.avgPct, "Average points lost": null, "Runs with points lost": null, Runs: s.attempts, "How to improve": "" })),
    ...gaps.map((g) => ({ Type: "Gap", Line: g.label, "Average (% of max)": null, "Average points lost": g.avgLost, "Runs with points lost": g.lostIn, Runs: g.attempts, "How to improve": g.howToImprove })),
  ];
}

export function buildProfileSheets(rows: readonly AttemptRow[]): SheetSpec[] {
  return [
    { name: "Attempts", rows: oldestFirst(rows).map(attemptBase) },
    { name: "Score lines", rows: profileLineRows(rows) },
    { name: "Strengths & gaps", rows: strengthGapRows(rows) },
  ];
}

// ── Cohort ────────────────────────────────────────────────────────────────────

export const COHORT_README: readonly ReadmeRow[] = [
  { column: "Attempts", meaning: "One row for each run in the current filter, with the points and the reason for every scored line. Empty line columns mean the run was saved before line scores were stored." },
  { column: "<line> (pts)", meaning: "Points earned on that line." },
  { column: "<line> reason", meaning: "Why the line scored what it did." },
  { column: "Line summary", meaning: "For each line, across runs that have line scores: average points, the share of students who lost points, the most common level, the most common reason, how to improve, and a note for trainers." },
  { column: "Crisis choices", meaning: "For each crisis and option: how many runs chose it, the share, and the average points (crisis lines are worth 8, 9 and 8)." },
];

/** Line columns in order: v1 lines first, then any others (v2) in the order first seen. */
function lineColumns(rows: readonly AttemptRow[]): { key: string; label: string }[] {
  const all = rows.map(attemptLines).filter((l): l is LineResult[] => l !== null).flat();
  const seen = new Map<string, string>();
  for (const l of all) if (!seen.has(l.key)) seen.set(l.key, l.label);
  const v1 = RUBRICS.filter((r) => seen.has(r.key)).map((r) => ({ key: r.key, label: seen.get(r.key) ?? r.label }));
  const rest = Array.from(seen.entries()).filter(([k]) => !isRubricKey(k)).map(([key, label]) => ({ key, label }));
  return [...v1, ...rest];
}

function cohortAttemptRow(row: AttemptRow, columns: readonly { key: string; label: string }[]): Row {
  const lines = attemptLines(row);
  const lineCells = Object.fromEntries(columns.flatMap((c) => {
    const l = lines?.find((x) => x.key === c.key);
    return [[`${c.label} (pts)`, l ? l.earned : null], [`${c.label} reason`, l ? l.note : ""]];
  }));
  return { Name: row.name, Email: row.email, Batch: row.batch_code, ...attemptBase(row), ...lineCells };
}

function lineSummaryRows(rows: readonly AttemptRow[]): Row[] {
  return lineStats(rows).map((s) => {
    const top = s.tiers.reduce((a, b) => (b.count > a.count ? b : a), s.tiers[0]);
    return {
      Category: categoryLabel(s.category),
      Line: s.label,
      Max: s.max,
      "Runs with line scores": s.n,
      "Average earned": s.avgEarned,
      "Lost points (%)": s.pctLost,
      "Most common level": s.n && top ? `${top.short} (${top.share}%)` : "",
      "Most common reason": s.topReasons[0]?.reason ?? "",
      "How to improve": s.howToImprove,
      "Note for trainers": s.dataNote,
    };
  });
}

function crisisChoiceRows(rows: readonly AttemptRow[]): Row[] {
  return crisisStats(rows).flatMap((c) => c.options.map((o) => ({
    Crisis: c.num, Title: c.title, Option: o.optionKey.toUpperCase(), "Option chosen": o.label,
    Runs: o.count, "Share (%)": o.share, "Average points": o.avgPoints, Max: c.max,
  })));
}

export function buildCohortSheets(rows: readonly AttemptRow[]): SheetSpec[] {
  const columns = lineColumns(rows);
  return [
    { name: "Attempts", rows: oldestFirst(rows).map((r) => cohortAttemptRow(r, columns)) },
    { name: "Line summary", rows: lineSummaryRows(rows) },
    { name: "Crisis choices", rows: crisisChoiceRows(rows) },
  ];
}
