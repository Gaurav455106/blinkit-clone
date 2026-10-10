// ── Scoring rubrics for the v1 100-point score (src/lib/newScoring.ts) ────────
// One rubric per score line. Every level mirrors a branch in newScoring.ts; if a
// rule changes there, change it here too (rubrics.test.ts runs the real scoring
// functions and fails when a result has no matching level).
//
// Lines saved by scoring v2 (score_breakdown.version = 2) carry their own
// judgedOn / tiers / howToImprove. lineGuide() prefers what the line carries and
// falls back to these v1 rubrics, so every screen can render both versions.
//
// Copy rule: plain words a 15-year-old understands, no em dashes.

import { SCORE_MAX, CRISIS_MAX, type FinalScore, type ScoreLine } from "@/lib/newScoring";

export type RubricCategory = keyof typeof SCORE_MAX;

export type RubricKey =
  | "comprehension" | "geo" | "keywords" | "skus"
  | "dayparting" | "newcampaign"
  | "crisis1" | "crisis2" | "crisis3"
  | "goalach" | "budgetutil";

/** One scoring level of a line ("tier" in code, "level" on screen). */
export interface RubricTier {
  /** Highest points in this level (the only value for fixed levels). */
  points: number;
  /** Lowest points in this level, when the level is a range (crisis lines). */
  minPoints?: number;
  /** The exact condition from the scoring code, in plain words. */
  condition: string;
  /** A few words for charts and cohort notes. */
  short: string;
  /** False when the current code can never award this level. */
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
  /** For trainers: what to teach when a group loses points here. */
  trainerTip: string;
}

/**
 * A scored line as shown on screen and saved in score_breakdown.lines.
 * v1 lines carry only the first six fields; v2 lines may carry their own guide.
 */
export interface LineResult {
  key: string;
  label: string;
  category: string;
  earned: number;
  max: number;
  note: string;
  judgedOn?: string;
  tiers?: RubricTier[];
  howToImprove?: string;
}

// ── Score versions and their categories ───────────────────────────────────────

export type ScoreVersion = 1 | 2;

export interface CategorySpec {
  key: string;
  label: string;
  max: number;
}

export const SCORE_SCHEMES: Record<ScoreVersion, readonly CategorySpec[]> = {
  1: [
    { key: "setup", label: "Setup", max: SCORE_MAX.setup },
    { key: "liveOpt", label: "Live optimisation", max: SCORE_MAX.liveOpt },
    { key: "crisis", label: "Crisis responses", max: SCORE_MAX.crisis },
    { key: "results", label: "Results", max: SCORE_MAX.results },
  ],
  2: [
    { key: "setup", label: "Setup", max: 25 },
    { key: "live", label: "Live optimisation", max: 35 },
    { key: "eventsRohit", label: "Market events and Rohit", max: 20 },
    { key: "results", label: "Results", max: 20 },
  ],
};

export const CATEGORY_ORDER: readonly RubricCategory[] = ["setup", "liveOpt", "crisis", "results"];

export const CATEGORY_LABELS: Record<RubricCategory, string> = {
  setup: "Setup",
  liveOpt: "Live optimisation",
  crisis: "Crisis responses",
  results: "Results",
};

/** Label for any category key in any version. */
export function categoryLabel(key: string, version: ScoreVersion = 1): string {
  return SCORE_SCHEMES[version].find((c) => c.key === key)?.label
    ?? SCORE_SCHEMES[1].find((c) => c.key === key)?.label
    ?? SCORE_SCHEMES[2].find((c) => c.key === key)?.label
    ?? key;
}

// ── Plain text ────────────────────────────────────────────────────────────────

/** Remove em dashes from older saved text: "A — b" becomes "A. B". */
export function plainText(s: string): string {
  return s
    .replace(/\s*—\s*([a-z])/g, (_m, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\s*—\s*/g, ". ")
    .replace(/\.\s*\./g, ".");
}

// ── Crisis ladders (derived from the scaling rule, so they stay exact) ────────
// earned = round(optionScore / bestOptionScore × max). Today every crisis has
// three options scored 10 (best), 6 (safe) and 0 (trap); no answer before the
// deadline applies the worst option.

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

function crisisTiers(max: number): RubricTier[] {
  const safePoints = Math.round(0.6 * max);
  const topFloor = (max - 0.5) / max;
  const safeFloor = (safePoints - 0.5) / max;
  const anyFloor = 0.5 / max;
  return [
    {
      points: max,
      condition: `You chose the best option (worth 10 out of 10), or any option worth at least ${pct(topFloor)} of the best option.`,
      short: "Best option",
    },
    {
      points: max - 1, minPoints: safePoints,
      condition: `You chose the safe option (worth 6 out of 10, which gives ${safePoints} points), or any option worth ${pct(safeFloor)} to ${pct(topFloor)} of the best option.`,
      short: "Safe option",
    },
    {
      points: safePoints - 1, minPoints: 1,
      condition: `You chose an option worth ${pct(anyFloor)} to ${pct(safeFloor)} of the best option. No crisis has an option like this today.`,
      short: "Weak option",
    },
    {
      points: 0,
      condition: "You chose the trap option (worth 0), or you did not answer in time so the worst option was used, or the run never reached this crisis.",
      short: "Trap, no answer or not reached",
    },
  ];
}

const CRISIS_SPEND_POINT: Record<1 | 2 | 3, string> = { 1: "a quarter", 2: "just over half", 3: "four fifths" };

function crisisRubric(num: 1 | 2 | 3): Rubric {
  return {
    key: `crisis${num}` as RubricKey,
    category: "crisis",
    label: `Crisis ${num} response`,
    max: CRISIS_MAX[num],
    judgedOn: `How good your choice was in crisis ${num}, which comes up once you have spent ${CRISIS_SPEND_POINT[num]} of the budget. The option's score is turned into ${CRISIS_MAX[num]} points.`,
    tiers: crisisTiers(CRISIS_MAX[num]),
    howToImprove: "Before you choose, think about what each option does to stock, spending and the client's goal for the rest of the run. Always answer before the deadline. If you don't, the worst option is used.",
    trainerTip: "go through the three options for this crisis and why the best one protects the client's goal",
  };
}

// ── The rubrics ───────────────────────────────────────────────────────────────

export const RUBRICS: readonly Rubric[] = [
  {
    key: "comprehension", category: "setup", label: "Brief comprehension", max: 20,
    judgedOn: "Whether your campaigns use the objective and ad format that fit the brand's main goal in the brief.",
    tiers: [
      { points: 20, condition: "At least one campaign uses the best objective for this brand, and at least one uses the best ad format.", short: "Right objective and format" },
      { points: 12, condition: "You used the best objective, and your formats are the right type for the goal (awareness, sales or both), but not the best format.", short: "Right objective, other format" },
      { points: 8, condition: "You used the best ad format, but no campaign uses the best objective.", short: "Right format, wrong objective" },
      { points: 6, condition: "You used neither the best objective nor the best format, but your formats are the right type for the goal.", short: "Right type of format only" },
      { points: 0, condition: "None of the above: your formats are not the right type for the goal, and the best format is not used.", short: "Objective and format both off" },
    ],
    howToImprove: "Read the brand's main goal in the brief first. Brands that care most about sales per ₹1 of ads (ROAS) need the Performance objective with Product Booster. Brands that need people to notice them need Reach with the format the brief points to.",
    trainerTip: "match each brand goal to its objective and format before students open the campaign builder",
  },
  {
    key: "geo", category: "setup", label: "Geography", max: 7,
    judgedOn: "How many of the states that have stock your campaigns reach. Ads only run where there is stock, so Pan India costs nothing extra.",
    tiers: [
      { points: 7, condition: "Your campaigns together reach every state that has stock (Pan India counts as all).", short: "All states with stock" },
      { points: 4, condition: "They reach at least half of the states that have stock, but not all.", short: "Half or more" },
      { points: 2, condition: "They reach some states that have stock, but fewer than half.", short: "Less than half" },
      { points: 0, condition: "None of the states you chose has stock.", short: "No state with stock" },
    ],
    howToImprove: "Check which states have stock in the brief and make sure every one of them is chosen. Pan India is safe, because ads never run where there is no stock.",
    trainerTip: "show that Pan India only serves states with stock, so picking fewer states just loses shoppers",
  },
  {
    key: "keywords", category: "setup", label: "Keyword quality", max: 5,
    judgedOn: "How many of your keywords (across all campaigns) are on the brand's list of keywords that lead to sales.",
    tiers: [
      { points: 5, condition: "Every keyword you chose is on the brand's list of good keywords.", short: "All good keywords" },
      { points: 3, condition: "You have more good keywords than risky or general ones.", short: "Mostly good keywords" },
      { points: 1, condition: "No keywords in any campaign (formats without keywords count as none), or risky and general keywords are as many as, or more than, the good ones.", short: "No or mostly risky keywords" },
    ],
    howToImprove: "Pick only keywords that match how shoppers search for the product. Drop the brand-name and general words the brief marks as risky.",
    trainerTip: "practise sorting a keyword list into good, brand-name and general words",
  },
  {
    key: "skus", category: "setup", label: "Product focus (SKUs)", max: 3,
    judgedOn: "How many different products (SKUs) your campaigns promote. Fewer products means each one gets enough budget to sell.",
    tiers: [
      { points: 3, condition: "One or two different products across all campaigns.", short: "One or two products" },
      { points: 2, condition: "Three or more products, but no more than half of the brand's range (rounded up).", short: "Up to half the range", reachable: false },
      { points: 0, condition: "More than half of the brand's range. Every brand has 3 products today, so promoting all 3 scores 0.", short: "Most or all products" },
    ],
    howToImprove: "Put the budget behind the main product (the hero SKU), and at most one more, instead of spreading it across the whole range.",
    trainerTip: "explain why one main product with a full budget beats a thin spread",
  },
  {
    key: "dayparting", category: "liveOpt", label: "Ad schedule (dayparting)", max: 15,
    judgedOn: "How much your best ad schedule beats running ads all day (24/7), and whether you set it by day 30. Dayparting means choosing the hours your ads run.",
    tiers: [
      { points: 15, condition: "Your best schedule makes ads at least 15% more effective than running all day, and you first changed it by day 30.", short: "Strong schedule, on time" },
      { points: 12, condition: "Your best schedule makes ads 10% to 15% more effective, and you first changed it by day 30.", short: "Good schedule, on time" },
      { points: 8, condition: "Your best schedule makes ads at least 10% more effective, but you changed it after day 30 (or the day was not recorded).", short: "Good schedule, late" },
      { points: 6, condition: "Your best schedule makes ads 5% to 10% more effective.", short: "Small improvement" },
      { points: 3, condition: "A schedule that turns off the busy hours. The scoring code never gives this today: such schedules score 0.", short: "Busy hours turned off", reachable: false },
      { points: 0, condition: "No schedule change, or your best schedule is less than 5% better than running all day. This includes schedules that turn off busy hours.", short: "All day, or no real change" },
    ],
    howToImprove: "Turn off the quiet hours (12 AM to 6 AM) and keep your category's busy hours on. Do it as early in the run as you can.",
    trainerTip: "teach dayparting before the run: quiet hours off, busy hours on",
  },
  {
    key: "newcampaign", category: "liveOpt", label: "New campaign during the run", max: 10,
    judgedOn: "Whether you started a new campaign after day 1 that does better than your first targeting.",
    tiers: [
      { points: 10, condition: "At least one campaign started after day 1 reaches more states with stock than your best first campaign, or uses fewer of your first risky keywords.", short: "New campaign, better targeting" },
      { points: 5, condition: "You started a campaign after day 1, but it repeats the same states and keywords.", short: "New campaign, same mistakes" },
      { points: 3, condition: "No campaign started after day 1. You get 3 points whether or not more than ₹10K was left.", short: "No new campaign" },
    ],
    howToImprove: "After the first week's numbers come in, start a second campaign that fixes what the numbers showed: more states with stock, or cleaner keywords.",
    trainerTip: "add a 'start a better second campaign' step to the week-1 review",
  },
  crisisRubric(1),
  crisisRubric(2),
  crisisRubric(3),
  {
    key: "goalach", category: "results", label: "Client goals reached", max: 10,
    judgedOn: "On average, how much of each client goal you reached. Each goal counts up to 150%.",
    tiers: [
      { points: 10, condition: "You reached 90% or more of the goals on average.", short: "90% or more" },
      { points: 7, condition: "You reached 70% to 89% of the goals on average.", short: "70% to 89%" },
      { points: 4, condition: "You reached 50% to 69% of the goals on average.", short: "50% to 69%" },
      { points: 1, condition: "You reached less than 50% of the goals on average.", short: "Under 50%" },
    ],
    howToImprove: "Build your campaigns around the client's goal numbers in the brief. Check them every week and move budget to whatever moves them.",
    trainerTip: "ask students to write the client goals down as numbers before they build",
  },
  {
    key: "budgetutil", category: "results", label: "Budget used", max: 5,
    judgedOn: "How much of the ₹2,00,000 budget you actually spent.",
    tiers: [
      { points: 5, condition: "You spent 85% or more of the budget.", short: "85% or more spent" },
      { points: 3, condition: "You spent 65% to 84% of the budget.", short: "65% to 84% spent" },
      { points: 1, condition: "You spent less than 65% of the budget.", short: "Under 65% spent" },
    ],
    howToImprove: "Check spending every week. If you are behind, raise budgets on what works or start a new campaign. If campaigns can't spend, check your states and stock.",
    trainerTip: "look at spending at each weekly check and what stops it (stock, states, budget type)",
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

function findTier(tiers: readonly RubricTier[], earned: number): RubricTier | null {
  return tiers.find((t) => earned <= t.points && earned >= (t.minPoints ?? t.points)) ?? null;
}

/** The v1 level an earned value falls in, or null if the code can't award that value. */
export function tierFor(key: string, earned: number): RubricTier | null {
  return isRubricKey(key) ? findTier(RUBRIC_BY_KEY[key].tiers, earned) : null;
}

// ── Generic guide for any line (v1 or v2) ─────────────────────────────────────

export interface LineGuide {
  judgedOn: string;
  tiers: readonly RubricTier[];
  howToImprove: string;
  trainerTip: string;
}

/** What a line is judged on, its levels and how to improve: from the line itself (v2) or the v1 rubric. */
export function lineGuide(line: Pick<LineResult, "key" | "judgedOn" | "tiers" | "howToImprove">): LineGuide {
  const v1 = isRubricKey(line.key) ? RUBRIC_BY_KEY[line.key] : null;
  return {
    judgedOn: line.judgedOn ?? v1?.judgedOn ?? "",
    tiers: line.tiers && line.tiers.length ? line.tiers : v1?.tiers ?? [],
    howToImprove: line.howToImprove ?? v1?.howToImprove ?? "",
    trainerTip: v1?.trainerTip ?? (line.howToImprove ? "go over what a full-marks answer looks like here" : ""),
  };
}

/** The level a line's points fall in, using its own levels when it has them. */
export function lineTier(line: Pick<LineResult, "key" | "earned" | "judgedOn" | "tiers" | "howToImprove">): RubricTier | null {
  return findTier(lineGuide(line).tiers, line.earned);
}

// ── Lines from a FinalScore ───────────────────────────────────────────────────

const MISSING_CRISIS_NOTE = "No answer recorded for this crisis, so it scored 0.";

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
    const fallback = r.category === "crisis" ? MISSING_CRISIS_NOTE : "Not scored in this run, because no campaigns were set up.";
    return {
      key: r.key,
      label: r.label,
      category: r.category,
      earned: line?.earned ?? 0,
      max: r.max,
      note: plainText(line?.note ?? fallback),
    };
  });
}

// ── Plain-English summary ─────────────────────────────────────────────────────

export interface CategorySummary {
  category: string;
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

/** Lower-case the first letter for mid-sentence use, but leave acronyms alone. */
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const trimStop = (s: string) => plainText(s).trim().replace(/[.\s]+$/, "");
const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;

function writeParagraph(s: Omit<CategorySummary, "paragraph">): string {
  const head = `${s.label}: ${s.earned} out of ${s.max}.`;
  if (s.lost.length === 0) {
    return s.wentWell.length ? `${head} Full marks. ${listWords(s.wentWell.map((l) => l.label))}: all at the top score.` : `${head} Full marks.`;
  }
  const parts = [head];
  const fullMarks = s.wentWell.filter((l) => l.earned >= l.max);
  if (fullMarks.length) parts.push(`Full marks for ${listWords(fullMarks.map((l) => lower(l.label)))}.`);
  const lostTotal = s.lost.reduce((sum, l) => sum + l.lostPoints, 0);
  const lostItems = s.lost.map((l) => `${l.label}: lost ${pts(l.lostPoints)}${l.note ? `. ${trimStop(l.note)}` : ""}.`);
  parts.push(`You lost ${pts(lostTotal)} here.`, ...lostItems);
  if (s.fixes.length) parts.push(`What to do next time: ${s.fixes.join(" ")}`);
  return parts.join(" ");
}

function summariseCategory(spec: CategorySpec, lines: readonly LineResult[]): CategorySummary {
  const mine = lines.filter((l) => l.category === spec.key);
  const earned = mine.reduce((s, l) => s + l.earned, 0);
  const wentWell = mine.filter((l) => l.max > 0 && l.earned >= l.max * 0.7);
  const lost = mine
    .filter((l) => l.earned < l.max)
    .map((l) => ({ ...l, lostPoints: l.max - l.earned }))
    .sort((a, b) => b.lostPoints - a.lostPoints);
  const fixes = lost
    .slice(0, MAX_FIXES)
    .map((l) => lineGuide(l).howToImprove)
    .filter((f, i, all) => f && all.indexOf(f) === i);
  const base = { category: spec.key, label: spec.label, earned, max: spec.max, wentWell, lost, fixes };
  return { ...base, paragraph: writeParagraph(base) };
}

function isFinalScore(input: FinalScore | readonly LineResult[]): input is FinalScore {
  return !Array.isArray(input) && typeof (input as FinalScore).grandTotal === "number";
}

/** A short plain-English paragraph per category: what went well, where points were lost, and what to do next time. */
export function qualitativeSummary(input: FinalScore | readonly LineResult[], version: ScoreVersion = 1): CategorySummary[] {
  const lines = isFinalScore(input) ? linesFromFinalScore(input) : input;
  return SCORE_SCHEMES[isFinalScore(input) ? 1 : version].map((spec) => summariseCategory(spec, lines));
}
