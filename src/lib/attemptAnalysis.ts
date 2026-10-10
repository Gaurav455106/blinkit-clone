// ── Attempt analysis: pure functions over rows from the `attempts` table ─────
// Used by the results page (saving), the student profile, and the admin and
// trainer cohort views. Handles three kinds of saved attempt:
//   - old v1 rows with category totals only (no score_breakdown.lines)
//   - v1 rows with lines (version 1; guide text comes from rubrics.ts)
//   - v2 rows (version 2; lines carry their own judgedOn / tiers / howToImprove)
// Scores from different versions are never mixed in one statistic.

import { crisisCardScore, type FinalScore, type ResultsScore } from "@/lib/newScoring";
import {
  RUBRICS, RUBRIC_BY_KEY, SCORE_SCHEMES, isRubricKey, lineGuide, lineTier, linesFromFinalScore, plainText,
  type LineResult, type RubricTier, type ScoreVersion,
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

export type CategoryTotals = Record<string, number>;
export type GoalRow = ResultsScore["goalRows"][number];

export interface SavedBreakdown {
  version: 1;
  grandTotal: number;
  grade: FinalScore["grade"];
  gradeLabel: string;
  setup: number;
  liveOpt: number;
  crisis: number;
  results: number;
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

/** The score_breakdown saved with each attempt. Keeps the older fields so old readers still work. */
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

export function attemptVersion(row: AttemptRow): ScoreVersion {
  return num(asRecord(row.score_breakdown)?.version) === 2 ? 2 : 1;
}

function parseTier(v: unknown): RubricTier | null {
  const o = asRecord(v);
  const points = num(o?.points);
  if (!o || points === null) return null;
  const condition = str(o.condition) ?? str(o.description) ?? str(o.label) ?? "";
  const minPoints = num(o.minPoints);
  return {
    points,
    ...(minPoints !== null ? { minPoints } : {}),
    condition: plainText(condition),
    short: plainText(str(o.short) ?? str(o.label) ?? condition),
  };
}

function parseTiers(v: unknown): RubricTier[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const tiers = v.map(parseTier).filter((t): t is RubricTier => t !== null);
  return tiers.length ? [...tiers].sort((a, b) => b.points - a.points) : undefined;
}

function parseLine(v: unknown): LineResult | null {
  const o = asRecord(v);
  if (!o) return null;
  const key = str(o.key);
  const earned = num(o.earned);
  const max = num(o.max);
  if (!key || earned === null || max === null) return null;
  const category = str(o.category) ?? (isRubricKey(key) ? RUBRIC_BY_KEY[key].category : null);
  if (!category) return null;
  const judgedOn = str(o.judgedOn);
  const howToImprove = str(o.howToImprove);
  const tiers = parseTiers(o.tiers);
  return {
    key, category, earned, max,
    label: str(o.label) ?? (isRubricKey(key) ? RUBRIC_BY_KEY[key].label : key),
    note: plainText(str(o.note) ?? ""),
    ...(judgedOn ? { judgedOn: plainText(judgedOn) } : {}),
    ...(howToImprove ? { howToImprove: plainText(howToImprove) } : {}),
    ...(tiers ? { tiers } : {}),
  };
}

/** Line-level scores, or null for attempts saved before lines were recorded (or with malformed lines). */
export function attemptLines(row: AttemptRow): LineResult[] | null {
  const raw = asRecord(row.score_breakdown)?.lines;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines = raw.map(parseLine);
  return lines.every((l): l is LineResult => l !== null) ? lines : null;
}

function totalsFrom(o: Json | null, version: ScoreVersion): CategoryTotals | null {
  if (!o) return null;
  const keys = SCORE_SCHEMES[version].map((c) => c.key);
  const vals = keys.map((k) => num(o[k]));
  if (vals.some((v) => v === null)) return null;
  return Object.fromEntries(keys.map((k, i) => [k, vals[i] as number]));
}

/** Category totals (keyed by the version's categories) from the breakdown, the legacy snapshot copy, or the lines. */
export function attemptTotals(row: AttemptRow): CategoryTotals | null {
  const version = attemptVersion(row);
  const direct = totalsFrom(asRecord(row.score_breakdown), version)
    ?? (version === 1 ? totalsFrom(asRecord(asRecord(row.snapshot)?.score_breakdown), 1) : null);
  if (direct) return direct;
  const lines = attemptLines(row);
  if (!lines) return null;
  return Object.fromEntries(
    SCORE_SCHEMES[version].map((c) => [c.key, lines.filter((l) => l.category === c.key).reduce((s, l) => s + l.earned, 0)]),
  );
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
    const key = str(o.optionKey) ?? "?";
    return [{
      crisisNum: n, score, maxScore,
      optionKey: key,
      optionLabel: plainText(str(o.optionLabel) ?? `Option ${key.toUpperCase()}`),
      title: plainText(str(o.title) ?? `Crisis ${n}`),
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
  version?: ScoreVersion;
}

export function filterAttempts(rows: readonly AttemptRow[], f: AttemptFilter): AttemptRow[] {
  return rows.filter((r) =>
    (!f.batch || f.batch === ALL || r.batch_code === f.batch) &&
    (!f.brand || f.brand === ALL || brandOf(r) === f.brand) &&
    (!f.version || attemptVersion(r) === f.version),
  );
}

/** Score versions present, newest first. */
export function versionsPresent(rows: readonly AttemptRow[]): ScoreVersion[] {
  const set = new Set(rows.map(attemptVersion));
  return ([2, 1] as const).filter((v) => set.has(v));
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
  { label: "0 to 19%", min: 0 }, { label: "20 to 39%", min: 0.2 }, { label: "40 to 59%", min: 0.4 },
  { label: "60 to 79%", min: 0.6 }, { label: "80 to 100%", min: 0.8 },
] as const;

function binShares(shares: readonly number[]): Bin[] {
  return SHARE_BINS.map((b, i) => {
    const next = SHARE_BINS[i + 1]?.min ?? Infinity;
    return { label: b.label, count: shares.filter((s) => s >= b.min && s < next).length };
  });
}

export interface CategoryStat {
  category: string;
  label: string;
  max: number;
  n: number;
  avg: number;
  pctOfMax: number;
  bins: Bin[];
}

/** Per-category averages and spread. Only rows of `version` count. */
export function categoryStats(rows: readonly AttemptRow[], version: ScoreVersion = 1): CategoryStat[] {
  const totals = rows
    .filter((r) => attemptVersion(r) === version)
    .map(attemptTotals)
    .filter((t): t is CategoryTotals => t !== null);
  return SCORE_SCHEMES[version].map((c) => {
    const vals = totals.map((t) => t[c.key] ?? 0);
    const avg = round1(mean(vals));
    return {
      category: c.key, label: c.label, max: c.max, n: vals.length,
      avg, pctOfMax: pctOf(avg, c.max),
      bins: binShares(vals.map((v) => v / c.max)),
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
  key: string;
  label: string;
  category: string;
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

function pointsText(t: Pick<TierCount, "points" | "minPoints">): string {
  return t.minPoints !== undefined && t.minPoints !== t.points ? `${t.minPoints} to ${t.points}` : `${t.points}`;
}

function dataNoteFor(max: number, n: number, tiers: readonly TierCount[], trainerTip: string): string {
  if (n === 0) return "No line-by-line scores yet for this view.";
  const losing = tiers.filter((t) => t.points < max && t.count > 0);
  if (losing.length === 0) return "Everyone in this view got full marks here.";
  const worst = losing.reduce((a, b) => (b.count > a.count ? b : a));
  const tip = trainerTip ? `: ${trainerTip}.` : ".";
  return `${worst.share}% scored ${pointsText(worst)} here (${worst.short.toLowerCase()})${tip}`;
}

/** Line keys in display order: v1 rubric order first, then any other keys in the order first seen. */
function orderedKeys(all: readonly LineResult[][]): string[] {
  const seen = new Set(all.flatMap((ls) => ls.map((l) => l.key)));
  const v1 = RUBRICS.map((r) => r.key).filter((k) => seen.has(k));
  const rest: string[] = [];
  for (const ls of all) for (const l of ls) if (!isRubricKey(l.key) && !rest.includes(l.key)) rest.push(l.key);
  return [...v1, ...rest];
}

function linesWithDetail(rows: readonly AttemptRow[]): LineResult[][] {
  return rows.map(attemptLines).filter((l): l is LineResult[] => l !== null);
}

/** Per-line statistics. Pass rows of one score version (see filterAttempts). */
export function lineStats(rows: readonly AttemptRow[]): LineStat[] {
  const all = linesWithDetail(rows);
  const keys = all.length ? orderedKeys(all) : RUBRICS.map((r) => r.key);
  return keys.map((key) => {
    const lines = all.map((ls) => ls.find((l) => l.key === key)).filter((l): l is LineResult => !!l);
    const sample: LineResult = lines.find((l) => l.tiers?.length) ?? lines[0] ?? emptyLine(key);
    const guide = lineGuide(sample);
    const n = lines.length;
    const levelOf = (l: LineResult) => lineTier({ ...l, tiers: l.tiers?.length ? l.tiers : [...guide.tiers] });
    const tiers = guide.tiers.map((t) => {
      const count = lines.filter((l) => sameLevel(levelOf(l), t)).length;
      return { points: t.points, minPoints: t.minPoints, short: t.short, condition: t.condition, count, share: pctOf(count, n) };
    });
    return {
      key, label: sample.label, category: sample.category, max: sample.max, n,
      avgEarned: round1(mean(lines.map((l) => l.earned))),
      pctLost: pctOf(lines.filter((l) => l.earned < l.max).length, n),
      tiers,
      topReasons: topReasons(lines.filter((l) => l.earned < l.max).map((l) => l.note)),
      howToImprove: guide.howToImprove,
      dataNote: dataNoteFor(sample.max, n, tiers, guide.trainerTip),
    };
  });
}

function emptyLine(key: string): LineResult {
  const r = isRubricKey(key) ? RUBRIC_BY_KEY[key] : null;
  return { key, label: r?.label ?? key, category: r?.category ?? "", earned: 0, max: r?.max ?? 0, note: "" };
}

function sameLevel(a: RubricTier | null, b: RubricTier): boolean {
  return !!a && a.points === b.points && (a.minPoints ?? a.points) === (b.minPoints ?? b.points);
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

/** v1 crisis choices from snapshot.crisisResponses. */
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

export interface Strength { key: string; label: string; avgPct: number; attempts: number }
export interface Gap { key: string; label: string; avgLost: number; lostIn: number; attempts: number; howToImprove: string }

const STRENGTH_SHARE = 0.8;

/** Lines a student usually scores well on, and lines they lose points on in most attempts. */
export function strengthsAndGaps(rows: readonly AttemptRow[]): { strengths: Strength[]; gaps: Gap[] } {
  const all = linesWithDetail(rows);
  if (all.length === 0) return { strengths: [], gaps: [] };
  const per = orderedKeys(all).map((key) => {
    const lines = all.map((ls) => ls.find((l) => l.key === key)).filter((l): l is LineResult => !!l);
    return { key, lines, label: lines[0].label, guide: lineGuide(lines.find((l) => l.howToImprove) ?? lines[0]) };
  });

  const strengths = per
    .map(({ key, label, lines }) => ({ key, label, attempts: lines.length, avgPct: pctOf(mean(lines.map((l) => l.earned)), mean(lines.map((l) => l.max))) }))
    .filter((s) => s.avgPct >= STRENGTH_SHARE * 100)
    .sort((a, b) => b.avgPct - a.avgPct);

  const gaps = per
    .map(({ key, label, lines, guide }) => ({
      key, label, attempts: lines.length, howToImprove: guide.howToImprove,
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
