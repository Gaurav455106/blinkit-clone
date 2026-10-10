// ── Scoring rubrics for the v1 100-point score (src/lib/newScoring.ts) ────────
// One rubric per score line. Every tier mirrors a branch in newScoring.ts; if a
// rule changes there, change it here too (rubrics.test.ts runs the real scoring
// functions and fails when a result has no matching tier).

import { SCORE_MAX, CRISIS_MAX, type FinalScore, type ScoreLine } from "@/lib/newScoring";

export type RubricCategory = keyof typeof SCORE_MAX;

export type RubricKey =
  | "comprehension" | "geo" | "keywords" | "skus"
  | "dayparting" | "newcampaign"
  | "crisis1" | "crisis2" | "crisis3"
  | "goalach" | "budgetutil";

export interface RubricTier {
  /** Highest points in this tier (the only value for fixed tiers). */
  points: number;
  /** Lowest points in this tier, when the tier is a range (crisis lines). */
  minPoints?: number;
  /** The exact condition from newScoring.ts, in plain words. */
  condition: string;
  /** Three-to-six word label for charts and cohort notes. */
  short: string;
  /** False when the current code can never award this tier. */
  reachable?: boolean;
}

export interface Rubric {
  key: RubricKey;
  category: RubricCategory;
  label: string;
  max: number;
  judgedOn: string;
  tiers: readonly RubricTier[];
  howToImprove: string;
  /** One line for trainers: what to teach when a cohort loses points here. */
  trainerTip: string;
}

/** A scored line as shown on the results page and saved in score_breakdown.lines. */
export interface LineResult {
  key: string;
  label: string;
  category: RubricCategory;
  earned: number;
  max: number;
  note: string;
}

export const CATEGORY_ORDER: readonly RubricCategory[] = ["setup", "liveOpt", "crisis", "results"];

export const CATEGORY_LABELS: Record<RubricCategory, string> = {
  setup: "Setup",
  liveOpt: "Live optimisation",
  crisis: "Crisis responses",
  results: "Results",
};

// ── Crisis ladders (derived from the scaling rule, so they stay exact) ────────
// earned = round(optionScore / bestOptionScore × max). Today every crisis has
// three options scored 10 (best), 6 (safe) and 0 (trap); no response before
// the deadline applies the worst option.

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

function crisisTiers(max: number): RubricTier[] {
  const safePoints = Math.round(0.6 * max);
  const topFloor = (max - 0.5) / max;
  const safeFloor = (safePoints - 0.5) / max;
  const anyFloor = 0.5 / max;
  return [
    {
      points: max,
      condition: `Chose the best option (10 of 10), or any option worth at least ${pct(topFloor)} of the best option's score.`,
      short: "Best option",
    },
    {
      points: max - 1, minPoints: safePoints,
      condition: `Chose the safe option (6 of 10 gives ${safePoints}), or any option worth ${pct(safeFloor)} to ${pct(topFloor)} of the best option's score.`,
      short: "Safe option",
    },
    {
      points: safePoints - 1, minPoints: 1,
      condition: `Chose an option worth ${pct(anyFloor)} to ${pct(safeFloor)} of the best option's score. No current crisis has an option in this range.`,
      short: "Weak option",
    },
    {
      points: 0,
      condition: `Chose the trap option (0 of 10), let the deadline pass so the worst option was applied, or never reached this crisis.`,
      short: "Trap, timed out or not reached",
    },
  ];
}

function crisisRubric(num: 1 | 2 | 3, judgedOn: string): Rubric {
  return {
    key: `crisis${num}` as RubricKey,
    category: "crisis",
    label: `Crisis ${num} response`,
    max: CRISIS_MAX[num],
    judgedOn,
    tiers: crisisTiers(CRISIS_MAX[num]),
    howToImprove: "Before choosing, ask what the option does to stock, spend and the client's goal over the rest of the run. Answer before the deadline: a missed crisis applies the worst option.",
    trainerTip: "walk through the three options for this crisis and why the best one protects the goal",
  };
}

// ── The rubrics ───────────────────────────────────────────────────────────────

export const RUBRICS: readonly Rubric[] = [
  {
    key: "comprehension", category: "setup", label: "Brief comprehension", max: 20,
    judgedOn: "Whether your campaigns use the objective and ad format that fit the brand's goal type in the brief.",
    tiers: [
      { points: 20, condition: "At least one campaign uses the brand's optimal objective and at least one uses its optimal ad format.", short: "Right objective and format" },
      { points: 12, condition: "The optimal objective is used and your formats cover the bucket the goal type needs (awareness, conversion or both), but the optimal format isn't used.", short: "Right objective, other format" },
      { points: 8, condition: "The optimal format is used, but no campaign uses the optimal objective.", short: "Right format, wrong objective" },
      { points: 6, condition: "Neither the optimal objective nor the optimal format, but your formats cover the bucket the goal type needs.", short: "Right bucket only" },
      { points: 0, condition: "None of the above: the required format bucket isn't covered and the optimal format isn't used.", short: "Objective and format miss" },
    ],
    howToImprove: "Read the goal type in the brief first: ROAS-first brands need Performance with Product Booster; awareness and category-creation brands need Reach with the format the brief points to.",
    trainerTip: "map each goal type to its objective and format before students open the wizard",
  },
  {
    key: "geo", category: "setup", label: "Geography", max: 7,
    judgedOn: "How many of the states that hold stock your campaigns reach. Ads only run where stock exists, so Pan India costs nothing extra.",
    tiers: [
      { points: 7, condition: "Your campaigns together reach every stocked state (Pan India counts as all).", short: "All stocked states" },
      { points: 4, condition: "They reach at least half of the stocked states, but not all.", short: "Half or more stocked states" },
      { points: 2, condition: "They reach some stocked states, but fewer than half.", short: "Under half of stocked states" },
      { points: 0, condition: "None of the targeted states has stock.", short: "No stocked state" },
    ],
    howToImprove: "Check which states have stock in the brief and make sure every one of them is targeted. Pan India is safe because ads never run where there is no stock.",
    trainerTip: "show that Pan India only serves stocked states, so narrowing geography loses demand",
  },
  {
    key: "keywords", category: "setup", label: "Keyword quality", max: 5,
    judgedOn: "The share of your selected keywords (across all campaigns) that are on the brand's list of keywords that convert.",
    tiers: [
      { points: 5, condition: "Every selected keyword is on the brand's good-keyword list.", short: "All keywords on target" },
      { points: 3, condition: "Good keywords outnumber the risky or generic ones.", short: "Mostly good keywords" },
      { points: 1, condition: "No keywords selected in any campaign (formats without keyword targeting count as none), or risky and generic keywords equal or outnumber the good ones.", short: "No or mostly risky keywords" },
    ],
    howToImprove: "Pick only the keywords that match how shoppers search for the product. Drop the brand-name and generic terms the brief flags as risky.",
    trainerTip: "practise sorting a keyword list into converting, brand and generic terms",
  },
  {
    key: "skus", category: "setup", label: "SKU focus", max: 3,
    judgedOn: "How many different SKUs your campaigns promote. Fewer SKUs means each one gets enough budget to sell.",
    tiers: [
      { points: 3, condition: "One or two different SKUs across all campaigns.", short: "One or two SKUs" },
      { points: 2, condition: "Three or more SKUs, but no more than half the catalogue (rounded up).", short: "Up to half the catalogue", reachable: false },
      { points: 0, condition: "More than half the catalogue. Every current brand has 3 SKUs, so promoting all 3 scores 0.", short: "Most or all SKUs" },
    ],
    howToImprove: "Back the hero SKU (and at most one more) instead of spreading the budget across the whole range.",
    trainerTip: "explain hero-SKU focus: concentrated budget beats a thin spread",
  },
  {
    key: "dayparting", category: "liveOpt", label: "Dayparting", max: 15,
    judgedOn: "How much your best custom ad schedule improves on running 24/7 (the schedule multiplier), and whether you set it by day 30.",
    tiers: [
      { points: 15, condition: "Best schedule multiplier is 1.15 or higher and the first schedule change was made by day 30.", short: "Strong schedule, on time" },
      { points: 12, condition: "Best schedule multiplier is 1.10 to 1.15 and the first change was made by day 30.", short: "Good schedule, on time" },
      { points: 8, condition: "Best schedule multiplier is 1.10 or higher, but the first change was made after day 30 (or its day wasn't recorded).", short: "Good schedule, late" },
      { points: 6, condition: "Best schedule multiplier is 1.05 to 1.10.", short: "Partial schedule" },
      { points: 3, condition: "A schedule that removes peak hours (multiplier below 1.0). The current code never awards this: such schedules score 0.", short: "Peaks removed", reachable: false },
      { points: 0, condition: "No schedule change, or the best schedule multiplier is below 1.05 (this includes schedules that cut peak hours).", short: "24/7 or no real change" },
    ],
    howToImprove: "Switch off the dead hours (12–6 AM) and keep the brand's peak slots on, as early in the run as you can.",
    trainerTip: "teach dayparting before the run: dead hours off, category peaks on",
  },
  {
    key: "newcampaign", category: "liveOpt", label: "Mid-run campaign launch", max: 10,
    judgedOn: "Whether you launched a new campaign after day 1 that improves on your original targeting.",
    tiers: [
      { points: 10, condition: "At least one campaign launched after day 1 reaches more stocked states than your best original campaign, or uses fewer of the original risky keywords.", short: "Launched and improved" },
      { points: 5, condition: "Launched a campaign after day 1, but it repeats the original geography and keyword choices.", short: "Launched, same mistakes" },
      { points: 3, condition: "No campaign launched after day 1 (scored the same whether or not more than ₹10K was left).", short: "No mid-run launch" },
    ],
    howToImprove: "Once the first week's data is in, launch a follow-up campaign that fixes what the data showed: more stocked states or cleaner keywords.",
    trainerTip: "build a 'launch a better second campaign' step into the week-1 review",
  },
  crisisRubric(1, "The quality of your response to crisis 1 (at 25% of budget spent), scaled from the option's score to 8 points."),
  crisisRubric(2, "The quality of your response to crisis 2 (at 55% of budget spent), scaled from the option's score to 9 points."),
  crisisRubric(3, "The quality of your response to crisis 3 (at 80% of budget spent), scaled from the option's score to 8 points."),
  {
    key: "goalach", category: "results", label: "Goal achievement", max: 10,
    judgedOn: "The average share of each client goal you reached, with each goal capped at 150%.",
    tiers: [
      { points: 10, condition: "Average goal achievement of 90% or more.", short: "90%+ of goals" },
      { points: 7, condition: "Average goal achievement of 70% to 89%.", short: "70–89% of goals" },
      { points: 4, condition: "Average goal achievement of 50% to 69%.", short: "50–69% of goals" },
      { points: 1, condition: "Average goal achievement below 50%.", short: "Under 50% of goals" },
    ],
    howToImprove: "Plan the setup around the client's goal metrics from the brief, then check them every week and move budget to what moves them.",
    trainerTip: "make students restate the client goals as numbers before they build",
  },
  {
    key: "budgetutil", category: "results", label: "Budget utilisation", max: 5,
    judgedOn: "The share of the scenario budget (₹2,00,000) you actually spent.",
    tiers: [
      { points: 5, condition: "Spent 85% or more of the budget.", short: "85%+ spent" },
      { points: 3, condition: "Spent 65% to 84% of the budget.", short: "65–84% spent" },
      { points: 1, condition: "Spent less than 65% of the budget.", short: "Under 65% spent" },
    ],
    howToImprove: "Watch pacing each week. If spend is behind, raise budgets on what works or launch a new campaign; check geography and stock if campaigns can't spend.",
    trainerTip: "review pacing at each checkpoint and what blocks spend (stock, geography, budget type)",
  },
];

export const RUBRIC_BY_KEY: Record<RubricKey, Rubric> = Object.fromEntries(
  RUBRICS.map((r) => [r.key, r]),
) as Record<RubricKey, Rubric>;

export function isRubricKey(key: string): key is RubricKey {
  return key in RUBRIC_BY_KEY;
}

export function rubricsForCategory(category: RubricCategory): Rubric[] {
  return RUBRICS.filter((r) => r.category === category);
}

/** The tier an earned value falls in, or null if the code can't award that value. */
export function tierFor(key: string, earned: number): RubricTier | null {
  if (!isRubricKey(key)) return null;
  return RUBRIC_BY_KEY[key].tiers.find((t) => earned <= t.points && earned >= (t.minPoints ?? t.points)) ?? null;
}

// ── Lines from a FinalScore ───────────────────────────────────────────────────

const MISSING_NOTE: Partial<Record<RubricKey, string>> = {
  crisis1: "No response recorded for this crisis, so it scored 0.",
  crisis2: "No response recorded for this crisis, so it scored 0.",
  crisis3: "No response recorded for this crisis, so it scored 0.",
};

/** All 11 lines in rubric order. Lines the score doesn't contain (unanswered crises, no campaigns) score 0. */
export function linesFromFinalScore(fs: FinalScore): LineResult[] {
  const scored: ScoreLine[] = [
    ...fs.setup.lines,
    fs.liveOpt.daypartingLine,
    fs.liveOpt.newCampaignLine,
    ...fs.crisis.lines,
    ...fs.results.lines,
  ];
  const byKey = new Map(scored.map((l) => [l.key, l]));
  return RUBRICS.map((r) => {
    const line = byKey.get(r.key);
    return {
      key: r.key,
      label: r.label,
      category: r.category,
      earned: line?.earned ?? 0,
      max: r.max,
      note: line?.note ?? MISSING_NOTE[r.key] ?? "Not scored in this run (no campaigns were set up).",
    };
  });
}

// ── Qualitative summary ───────────────────────────────────────────────────────

export interface CategorySummary {
  category: RubricCategory;
  label: string;
  earned: number;
  max: number;
  wentWell: LineResult[];
  lost: (LineResult & { lostPoints: number })[];
  fixes: string[];
  paragraph: string;
}

const MAX_FIXES = 2;

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Lower-case the first letter for mid-sentence use, but leave acronyms ("SKU focus") alone. */
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const trimStop = (s: string) => s.trim().replace(/[.\s]+$/, "");

function writeParagraph(label: string, earned: number, max: number, wentWell: LineResult[], lost: CategorySummary["lost"], fixes: string[]): string {
  const head = `${label}: ${earned} of ${max}.`;
  if (lost.length === 0) return `${head} Full marks: ${listWords(wentWell.map((l) => lower(l.label)))} all scored the maximum.`;
  const parts = [head];
  if (wentWell.length) {
    parts.push(`Went well: ${listWords(wentWell.map((l) => `${lower(l.label)} (${l.earned}/${l.max})`))}.`);
  }
  const lostTotal = lost.reduce((s, l) => s + l.lostPoints, 0);
  const lostItems = lost.map((l) => `${lower(l.label)} lost ${l.lostPoints}${l.note ? ` (${trimStop(l.note)})` : ""}`);
  parts.push(`Lost ${lostTotal} point${lostTotal === 1 ? "" : "s"}: ${lostItems.join("; ")}.`);
  if (fixes.length) parts.push(`To fix first: ${fixes.join(" ")}`);
  return parts.join(" ");
}

function summariseCategory(category: RubricCategory, lines: readonly LineResult[]): CategorySummary {
  const mine = lines.filter((l) => l.category === category);
  const earned = mine.reduce((s, l) => s + l.earned, 0);
  const max = SCORE_MAX[category];
  const wentWell = mine.filter((l) => l.max > 0 && l.earned >= l.max * 0.7);
  const lost = mine
    .filter((l) => l.earned < l.max)
    .map((l) => ({ ...l, lostPoints: l.max - l.earned }))
    .sort((a, b) => b.lostPoints - a.lostPoints);
  const fixes = lost
    .slice(0, MAX_FIXES)
    .map((l) => (isRubricKey(l.key) ? RUBRIC_BY_KEY[l.key].howToImprove : ""))
    .filter((f, i, all) => f && all.indexOf(f) === i);
  const label = CATEGORY_LABELS[category];
  return { category, label, earned, max, wentWell, lost, fixes, paragraph: writeParagraph(label, earned, max, wentWell, lost, fixes) };
}

function isFinalScore(input: FinalScore | readonly LineResult[]): input is FinalScore {
  return !Array.isArray(input) && typeof (input as FinalScore).grandTotal === "number";
}

/** A short plain-English paragraph per category: what went well, where marks were lost, and what to fix first. */
export function qualitativeSummary(input: FinalScore | readonly LineResult[]): CategorySummary[] {
  const lines = isFinalScore(input) ? linesFromFinalScore(input) : input;
  return CATEGORY_ORDER.map((c) => summariseCategory(c, lines));
}
