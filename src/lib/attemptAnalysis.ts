// ── Attempt analysis: pure functions over rows from the `attempts` table ─────
// Used by the results page (saving), the student profile, and the admin and
// trainer cohort views. Attempts saved before line-level scoring have no
// `score_breakdown.lines`; every function here copes with that.

import { SCORE_MAX, crisisCardScore, type FinalScore, type ResultsScore } from "@/lib/newScoring";
import {
  RUBRICS, RUBRIC_BY_KEY, CATEGORY_ORDER, CATEGORY_LABELS, isRubricKey, tierFor, linesFromFinalScore,
  type LineResult, type RubricCategory, type RubricKey,
} from "@/lib/rubrics";

export interface AttemptRow {
  id: string;
  name: string;
  email: string;
  batch_code: string;
  profile_id: string;
  score_total: number;
  score_breakdown: unknown;
  created_at: string;
  snapshot?: unknown;
  scenario?: unknown;
  crisis_choice?: string | null;
  crisis_points?: number;
  choices?: unknown;
  badge?: string | null;
}

export type CategoryTotals = Record<RubricCategory, number>;
export type GoalRow = ResultsScore["goalRows"][number];

export interface SavedBreakdown extends CategoryTotals {
  version: 1;
  grandTotal: number;
  grade: FinalScore["grade"];
  gradeLabel: string;
  achievementPct: number;
  lines: LineResult[];
  goalRows: GoalRow[];
}

// ── Safe readers for untyped JSON ─────────────────────────────────────────────

type Json = Record<string, unknown>;

function asRecord(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

// ── Saving ────────────────────────────────────────────────────────────────────

/** The score_breakdown saved with each attempt. Keeps the pre-v1 fields so old readers still work. */
export function buildSavedBreakdown(fs: FinalScore): SavedBreakdown {
  return {
    version: 1,
    grandTotal: fs.grandTotal,
    grade: fs.grade,
    gradeLabel: fs.gradeLabel,
    setup: fs.setup.total,
    liveOpt: fs.liveOpt.total,
    crisis: fs.crisis.total,
    results: fs.results.total,
    achievementPct: fs.results.achievementPct,
    lines: linesFromFinalScore(fs),
    goalRows: fs.results.goalRows,
  };
}

// ── Reading ───────────────────────────────────────────────────────────────────

function parseLine(v: unknown): LineResult | null {
  const o = asRecord(v);
  if (!o) return null;
  const key = str(o.key);
  const earned = num(o.earned);
  const max = num(o.max);
  if (!key || earned === null || max === null) return null;
  const savedCat = str(o.category);
  const category: RubricCategory | null =
    savedCat && (CATEGORY_ORDER as readonly string[]).includes(savedCat) ? (savedCat as RubricCategory)
    : isRubricKey(key) ? RUBRIC_BY_KEY[key].category : null;
  if (!category) return null;
  return {
    key, category, earned, max,
    label: str(o.label) ?? (isRubricKey(key) ? RUBRIC_BY_KEY[key].label : key),
    note: str(o.note) ?? "",
  };
}

/** Line-level scores, or null for attempts saved before lines were recorded (or with malformed lines). */
export function attemptLines(row: AttemptRow): LineResult[] | null {
  const raw = asRecord(row.score_breakdown)?.lines;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines = raw.map(parseLine);
  return lines.every((l): l is LineResult => l !== null) ? lines : null;
}

function totalsFrom(o: Json | null): CategoryTotals | null {
  if (!o) return null;
  const vals = CATEGORY_ORDER.map((c) => num(o[c]));
  if (vals.some((v) => v === null)) return null;
  return Object.fromEntries(CATEGORY_ORDER.map((c, i) => [c, vals[i] as number])) as CategoryTotals;
}

/** Category totals from the saved breakdown, the legacy snapshot copy, or the lines. */
export function attemptTotals(row: AttemptRow): CategoryTotals | null {
  const direct = totalsFrom(asRecord(row.score_breakdown)) ?? totalsFrom(asRecord(asRecord(row.snapshot)?.score_breakdown));
  if (direct) return direct;
  const lines = attemptLines(row);
  if (!lines) return null;
  return Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, lines.filter((l) => l.category === c).reduce((s, l) => s + l.earned, 0)]),
  ) as CategoryTotals;
}

export function brandOf(row: AttemptRow): string {
  const snapProfile = asRecord(asRecord(asRecord(row.snapshot)?.scenario)?.profile);
  return str(snapProfile?.name) ?? str(asRecord(row.scenario)?.profile) ?? row.profile_id ?? "Unknown";
}

export function gradeLabelOf(row: AttemptRow): string {
  const saved = str(asRecord(row.score_breakdown)?.gradeLabel);
  if (saved) return saved;
  const t = row.score_total;
  return t >= 90 ? "QCommerce Pro" : t >= 75 ? "Sharp Strategist" : t >= 60 ? "Growing Fast" : t >= 40 ? "Still Learning" : "Back to Basics";
}

export function goalRowsOf(row: AttemptRow): GoalRow[] {
  const raw = asRecord(row.score_breakdown)?.goalRows;
  return Array.isArray(raw) ? (raw.filter((g) => asRecord(g) && str(asRecord(g)!.label)) as GoalRow[]) : [];
}

export interface CrisisResponseLite {
  crisisNum: 1 | 2 | 3;
  optionKey: string;
  optionLabel: string;
  title: string;
  day: number | null;
  score: number;
  maxScore: number | null;
  earned: number;
  max: number;
}

export function attemptCrisisResponses(row: AttemptRow): CrisisResponseLite[] {
  const raw = asRecord(asRecord(row.snapshot)?.crisisResponses);
  if (!raw) return [];
  return Object.values(raw).flatMap((v): CrisisResponseLite[] => {
    const o = asRecord(v);
    const n = num(o?.crisisNum);
    if (!o || (n !== 1 && n !== 2 && n !== 3)) return [];
    const score = num(o.score) ?? 0;
    const maxScore = num(o.maxScore);
    const pts = crisisCardScore({ crisisNum: n, score, maxScore: maxScore ?? undefined });
    return [{
      crisisNum: n, score, maxScore,
      optionKey: str(o.optionKey) ?? "?",
      optionLabel: str(o.optionLabel) ?? `Option ${(str(o.optionKey) ?? "?").toUpperCase()}`,
      title: str(o.title) ?? `Crisis ${n}`,
      day: num(o.day),
      earned: pts.earned, max: pts.max,
    }];
  }).sort((a, b) => a.crisisNum - b.crisisNum);
}

// ── Filtering and grouping ────────────────────────────────────────────────────

export const ALL = "All";

export interface AttemptFilter {
  batch?: string;
  brand?: string;
}

export function filterAttempts(rows: readonly AttemptRow[], f: AttemptFilter): AttemptRow[] {
  return rows.filter((r) =>
    (!f.batch || f.batch === ALL || r.batch_code === f.batch) &&
    (!f.brand || f.brand === ALL || brandOf(r) === f.brand),
  );
}

export function latestFirst(rows: readonly AttemptRow[]): AttemptRow[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function oldestFirst(rows: readonly AttemptRow[]): AttemptRow[] {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Highest-scoring attempt per email (latest wins a tie). */
export function bestPerStudent(rows: readonly AttemptRow[]): AttemptRow[] {
  const best = new Map<string, AttemptRow>();
  for (const r of rows) {
    const prev = best.get(r.email);
    if (!prev || r.score_total > prev.score_total || (r.score_total === prev.score_total && r.created_at > prev.created_at)) {
      best.set(r.email, r);
    }
  }
  return Array.from(best.values());
}

export function distinctSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

// ── Cohort statistics ─────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export interface Bin { label: string; count: number }

const SHARE_BINS = [
  { label: "0–19%", min: 0 }, { label: "20–39%", min: 0.2 }, { label: "40–59%", min: 0.4 },
  { label: "60–79%", min: 0.6 }, { label: "80–100%", min: 0.8 },
] as const;

function binShares(shares: readonly number[]): Bin[] {
  return SHARE_BINS.map((b, i) => {
    const next = SHARE_BINS[i + 1]?.min ?? Infinity;
    return { label: b.label, count: shares.filter((s) => s >= b.min && s < next).length };
  });
}

export interface CategoryStat {
  category: RubricCategory;
  label: string;
  max: number;
  n: number;
  avg: number;
  pctOfMax: number;
  bins: Bin[];
}

export function categoryStats(rows: readonly AttemptRow[]): CategoryStat[] {
  const totals = rows.map(attemptTotals).filter((t): t is CategoryTotals => t !== null);
  return CATEGORY_ORDER.map((c) => {
    const vals = totals.map((t) => t[c]);
    const avg = round1(mean(vals));
    return {
      category: c, label: CATEGORY_LABELS[c], max: SCORE_MAX[c], n: vals.length,
      avg, pctOfMax: pctOf(avg, SCORE_MAX[c]),
      bins: binShares(vals.map((v) => v / SCORE_MAX[c])),
    };
  });
}

export interface TierCount {
  points: number;
  minPoints?: number;
  short: string;
  condition: string;
  count: number;
  share: number;
}

export interface LineStat {
  key: RubricKey;
  label: string;
  category: RubricCategory;
  max: number;
  n: number;
  avgEarned: number;
  pctLost: number;
  tiers: TierCount[];
  topReasons: { reason: string; count: number }[];
  howToImprove: string;
  dataNote: string;
}

const MAX_REASONS = 3;

/** Notes differ only by numbers ("₹45K left", "₹80K left"); group them on the wording. */
const reasonKey = (note: string) => note.replace(/\d+(?:[.,]\d+)*/g, "#").trim();

function topReasons(notes: readonly string[]): { reason: string; count: number }[] {
  const groups = new Map<string, { reason: string; count: number }>();
  for (const note of notes) {
    if (!note) continue;
    const k = reasonKey(note);
    const g = groups.get(k);
    groups.set(k, { reason: g?.reason ?? note, count: (g?.count ?? 0) + 1 });
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, MAX_REASONS);
}

function dataNoteFor(key: RubricKey, n: number, tiers: readonly TierCount[]): string {
  if (n === 0) return "No line-level data yet for this view.";
  const losing = tiers.filter((t) => t.points < RUBRIC_BY_KEY[key].max && t.count > 0);
  if (losing.length === 0) return "Everyone in this view scored full marks here.";
  const worst = losing.reduce((a, b) => (b.count > a.count ? b : a));
  const pts = worst.minPoints !== undefined && worst.minPoints !== worst.points ? `${worst.minPoints}–${worst.points}` : `${worst.points}`;
  return `${worst.share}% scored ${pts} here (${worst.short.toLowerCase()}): ${RUBRIC_BY_KEY[key].trainerTip}.`;
}

export function lineStats(rows: readonly AttemptRow[]): LineStat[] {
  const all = rows.map(attemptLines).filter((l): l is LineResult[] => l !== null);
  return RUBRICS.map((r) => {
    const lines = all.map((ls) => ls.find((l) => l.key === r.key)).filter((l): l is LineResult => !!l);
    const n = lines.length;
    const tiers = r.tiers.map((t) => {
      const count = lines.filter((l) => tierFor(r.key, l.earned) === t).length;
      return { points: t.points, minPoints: t.minPoints, short: t.short, condition: t.condition, count, share: pctOf(count, n) };
    });
    return {
      key: r.key, label: r.label, category: r.category, max: r.max, n,
      avgEarned: round1(mean(lines.map((l) => l.earned))),
      pctLost: pctOf(lines.filter((l) => l.earned < l.max).length, n),
      tiers,
      topReasons: topReasons(lines.filter((l) => l.earned < l.max).map((l) => l.note)),
      howToImprove: r.howToImprove,
      dataNote: dataNoteFor(r.key, n, tiers),
    };
  });
}

export interface CrisisOptionStat { optionKey: string; label: string; count: number; share: number; avgPoints: number }

export interface CrisisStat {
  num: 1 | 2 | 3;
  title: string;
  n: number;
  max: number;
  avgPoints: number;
  options: CrisisOptionStat[];
}

function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) { best = k; n = c; }
  return best;
}

export function crisisStats(rows: readonly AttemptRow[]): CrisisStat[] {
  const responses = rows.flatMap(attemptCrisisResponses);
  return ([1, 2, 3] as const).map((n) => {
    const mine = responses.filter((r) => r.crisisNum === n);
    const keys = distinctSorted(mine.map((r) => r.optionKey));
    const options = keys.map((k) => {
      const picked = mine.filter((r) => r.optionKey === k);
      return {
        optionKey: k,
        label: mostCommon(picked.map((p) => p.optionLabel)) ?? k,
        count: picked.length,
        share: pctOf(picked.length, mine.length),
        avgPoints: round1(mean(picked.map((p) => p.earned))),
      };
    }).sort((a, b) => b.count - a.count);
    return {
      num: n,
      title: mostCommon(mine.map((r) => r.title)) ?? `Crisis ${n}`,
      n: mine.length,
      max: RUBRIC_BY_KEY[`crisis${n}`].max,
      avgPoints: mean(mine.map((r) => r.earned)),
      options,
    };
  });
}

// ── One student ───────────────────────────────────────────────────────────────

export interface Strength { key: RubricKey; label: string; avgPct: number; attempts: number }
export interface Gap { key: RubricKey; label: string; avgLost: number; lostIn: number; attempts: number; howToImprove: string }

const STRENGTH_SHARE = 0.8;

/** Lines a student consistently scores well on, and lines they lose points on in most attempts. */
export function strengthsAndGaps(rows: readonly AttemptRow[]): { strengths: Strength[]; gaps: Gap[] } {
  const all = rows.map(attemptLines).filter((l): l is LineResult[] => l !== null);
  if (all.length === 0) return { strengths: [], gaps: [] };
  const per = RUBRICS.map((r) => {
    const lines = all.map((ls) => ls.find((l) => l.key === r.key)).filter((l): l is LineResult => !!l);
    return { r, lines };
  }).filter((x) => x.lines.length > 0);

  const strengths = per
    .map(({ r, lines }) => ({ key: r.key, label: r.label, attempts: lines.length, avgPct: pctOf(mean(lines.map((l) => l.earned)), r.max) }))
    .filter((s) => s.avgPct >= STRENGTH_SHARE * 100)
    .sort((a, b) => b.avgPct - a.avgPct);

  const gaps = per
    .map(({ r, lines }) => ({
      key: r.key, label: r.label, attempts: lines.length, howToImprove: r.howToImprove,
      lostIn: lines.filter((l) => l.earned < l.max).length,
      avgLost: round1(mean(lines.map((l) => l.max - l.earned))),
    }))
    .filter((g) => g.lostIn > g.attempts / 2)
    .sort((a, b) => b.avgLost - a.avgLost);

  return { strengths, gaps };
}

/** created_at of the earliest attempt that has line detail, or null if none do. */
export function lineDetailSince(rows: readonly AttemptRow[]): string | null {
  const withLines = oldestFirst(rows).find((r) => attemptLines(r) !== null);
  return withLines?.created_at ?? null;
}
