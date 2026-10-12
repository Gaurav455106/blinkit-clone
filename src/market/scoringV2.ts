// ── Scoring v2 (SPEC §8, decision #5: Setup 25 · Live 35 · Events+Rohit 20 · Results 20) ──
// Every line carries its rubric (what's judged, tiers) and the reason it got
// its points, so the results page, profile, admin analysis and Excel exports
// can explain each mark. Saved attempts carry score_version 2.

import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import type { LiveAction } from "@/market/actions";
import type { StepOptions } from "@/market/step";
import type { EventActivation } from "@/market/events";
import type { CommitmentResult, ReplyQuality } from "@/market/rohit";
import { scoreEventResponses, ROHIT_QUALITY_SHARE } from "@/market/liveRun";
import { briefStock, type OpeningDeal } from "@/market/deal";
import { stockFit, valueAsked, valueGiven } from "@/market/dealRohit";
import { detectMoments, lossFloorFor, objectiveUnit, scoreMoment, type MomentScore, type ObjectiveUnit } from "@/market/moments";
import { scoreInsights, type Insight } from "@/market/insights";
import { clientGoalsV2 } from "@/market/goals";
import { sumMetrics, type Metrics } from "@/market/aggregate";
import { suggestKeywordRange } from "@/market/suggest";
import { maxProfitableCPM } from "@/market/shoppers";
import { isAwarenessFormat, isConversionFormat, requiredBuckets } from "@/lib/scoring";
import { FORMAT_NAMES, KEYWORD_FORMATS, SELLING_FORMATS, goodFormatsFor } from "@/market/formats";
import { clamp, line, round1 } from "@/market/scoreLine";
import { improvementLine, peakLine, scalingLine, steadyLine, wasteFloorFor, wastedSpendShare, LIVE_FACTOR_MAX } from "@/market/liveFactors";

export { wasteFloorFor, wastedSpendShare } from "@/market/liveFactors";

export const SCORE_V2_MAX = { setup: 25, live: 35, eventsRohit: 20, results: 20 } as const;
export type CategoryV2 = keyof typeof SCORE_V2_MAX;

export interface RubricTier {
  points: number;
  rule: string;
}

export interface ScoreLineV2 {
  key: string;
  category: CategoryV2;
  label: string;
  earned: number;
  max: number;
  judgedOn: string;
  tiers: readonly RubricTier[];
  /** Why this student got these points, with their numbers. */
  note: string;
  howToImprove: string;
}

export interface ScoreV2 {
  version: 2;
  lines: readonly ScoreLineV2[];
  totals: Readonly<Record<CategoryV2, number>>;
  grandTotal: number;
  moments: readonly MomentScore[];
  /** Top 3 decisions by ₹ (or goal units) lost vs the best lever. */
  costliestMistakes: readonly CostlyMistake[];
  run: Metrics;
  goalRows: readonly GoalRowV2[];
  /** Average goal achievement, % (each goal capped at 150). */
  achievementPct: number;
}

export interface ScoreV2Input {
  ctx: MarketContext;
  /** Campaigns as launched from the wizard (adapter output). */
  launched: readonly CampaignConfig[];
  /** Ad formats / objectives per campaign id, from the wizard. */
  formats: Readonly<Record<string, { adFormat: string | null; objective: string | null }>>;
  actions: readonly LiveAction[];
  results: readonly DayResult[];
  configsByDay: readonly (readonly CampaignConfig[])[];
  statesByDay: readonly MarketState[];
  /** v1 CM pitch score and its max (Rohit), if the pitch was played. */
  pitch: { score: number; max: number } | null;
  /** Insights logged at the weekly checkpoints (report → action). */
  insights: readonly Insight[];
  describeAction: (a: LiveAction) => string;
  /** Market events and Rohit effects of the run (needed for exact replays). */
  stepOptions?: StepOptions;
  /** Alerts that paused the clock (SPEC §5): the response to each is scored. */
  alerts?: readonly EventActivation[];
  /** v2 opening deal with Rohit (SPEC §6.1); replaces the v1 pitch score when present. */
  deal?: OpeningDeal | null;
  /** Mid-run Rohit check-ins: reply quality and how the promises turned out. */
  rohit?: { replies: readonly { quality: ReplyQuality }[]; commitments: readonly CommitmentResult[] };
}

/** What setup scoring needs: the launched campaigns and their formats. */
export type SetupInputV2 = Pick<ScoreV2Input, "ctx" | "launched" | "formats">;


// ── Setup (25) ────────────────────────────────────────────────────────────────

const article = (word: string) => (/^[AEIOU]/i.test(word) ? "an" : "a");

/** Format fit (SPEC §13 #31): the format decides it; the objective follows from the format as
 *  the wizard pairs them. Best format 8, another good one 6, right family 3. Overstocked brands
 *  need a selling format (#32). */
function formatFit(input: SetupInputV2): ScoreLineV2 {
  const { scenario } = input.ctx;
  const p = scenario.profile;
  const used = Object.values(input.formats).map((f) => f.adFormat).filter((f): f is string => !!f);
  const good = goodFormatsFor(scenario);
  const overstocked = scenario.inventory.tone === "overstocked";
  const bucket = overstocked ? "conversion" : requiredBuckets(p.goalType);
  const covered = bucket === "awareness" ? used.some((f) => isAwarenessFormat(f))
    : bucket === "conversion" ? used.some((f) => isConversionFormat(f) || SELLING_FORMATS.includes(f))
    : used.some((f) => isAwarenessFormat(f)) && used.some((f) => isConversionFormat(f));
  const best = used.includes(good[0]);
  const other = good.slice(1).some((f) => used.includes(f));
  const earned = best ? 8 : other ? 6 : covered ? 3 : 0;
  const names = good.map((f) => FORMAT_NAMES[f] ?? f);
  const why = overstocked ? "while stock is overstocked" : `for ${article(p.goalType)} ${p.goalType} brand`;
  return line({
    key: "v2_format", category: "setup", label: "Objective and format fit", earned: overstocked && !covered ? Math.min(earned, 2) : earned, max: 8,
    judgedOn: "Whether your campaigns use the ad formats that suit this brand right now. The objective comes with the format, as the wizard pairs them.",
    tiers: [
      { points: 8, rule: `The best format: ${names[0]}` },
      ...(names.length > 1 ? [{ points: 6, rule: `Another good format: ${names.slice(1).join(", ")}` }] : []),
      { points: 3, rule: "A format from the right family" },
      { points: 0, rule: "None of these" },
    ],
    note: best ? `${names[0]}: right ${why}.` : `Best ${why}: ${names.join(", then ")}.`,
    howToImprove: "Read the brief's \"Lead with\" line: it names the formats that suit this brand right now.",
  });
}

function keywordMaxCpm(input: Pick<ScoreV2Input, "ctx">, term: string, skuIds: readonly string[]): number {
  const k = input.ctx.market.keywords.find((x) => x.term === term);
  if (!k) return 0;
  const cat = input.ctx.market.category;
  return Math.max(0, ...input.ctx.scenario.profile.skus.filter((s) => skuIds.includes(s.id)).map((sku) => maxProfitableCPM({
    baseCTR: cat.baseCTR, creativeMult: 1, affinity: k.isBrandTerm ? 1.5 : 1, fatigueMult: 1,
    baseCVR: cat.baseCVR, fit: k.fit[sku.id] ?? 0, intent: 1, stateCVR: 1, priceEffect: 1,
    sellingPrice: sku.mrp, contributionPerUnit: sku.margin,
  })));
}

function keywordChoice(input: SetupInputV2): ScoreLineV2 {
  const chosen = input.launched.flatMap((c) => c.keywords.map((k) => ({ term: k.term, skus: c.skuIds })));
  const known = chosen.filter((k) => input.ctx.market.keywords.some((m) => m.term === k.term));
  const canProfit = known.filter((k) => keywordMaxCpm(input, k.term, k.skus) > suggestKeywordRange(input.ctx, k.term).lo);
  const share = known.length ? canProfit.length / known.length : 0;
  const traps = known.filter((k) => !canProfit.includes(k)).map((k) => k.term);
  // SPEC §13 #30: no keywords is right when none of the brand's good formats uses them
  const keywordsNeeded = goodFormatsFor(input.ctx.scenario).some((f) => KEYWORD_FORMATS.includes(f));
  return line({
    key: "v2_keywords", category: "setup", label: "Keyword choice", earned: chosen.length ? 5 * share : keywordsNeeded ? 0 : 5, max: 5,
    judgedOn: "How many of your keywords can make money. A keyword can make money if a click on it is worth more to you than the price you must pay to win the ad slot.",
    tiers: [{ points: 5, rule: "Every keyword can be profitable (or this brand doesn't need keywords)" }, { points: 0, rule: "None can (or no keywords where the brand needs them)" }],
    note: chosen.length === 0 ? (keywordsNeeded ? "No keyword campaigns, and this brand needs search." : "Not needed: this brand's best formats don't use keywords.") : traps.length ? `${canProfit.length} of ${known.length} keywords can pay; ${traps.slice(0, 3).join(", ")} cost more than they can earn.` : "Every keyword you picked can be profitable.",
    howToImprove: "Compare each keyword's suggested range with what a click is worth to you (max profitable CPM) and drop the ones that can't pay.",
  });
}

/** Max profitable CPM for a placement (category page, Stories feed, Rec Ads slot), mirroring
 *  the engine's placement maths in step.ts, at average intent and state. */
function placementMaxCpm(input: Pick<ScoreV2Input, "ctx">, placementId: string, skuIds: readonly string[]): number {
  const pl = input.ctx.market.placements.find((x) => x.id === placementId);
  if (!pl) return 0;
  const cat = input.ctx.market.category;
  return Math.max(0, ...input.ctx.scenario.profile.skus.filter((s) => skuIds.includes(s.id)).map((sku) => maxProfitableCPM({
    baseCTR: cat.baseCTR * pl.ctrMult, creativeMult: 1, affinity: 1, fatigueMult: 1,
    baseCVR: cat.baseCVR * pl.cvrMult, fit: pl.fit[sku.id] ?? 0, intent: 1, stateCVR: 1, priceEffect: 1,
    sellingPrice: sku.mrp, contributionPerUnit: sku.margin,
  })));
}

/** Bid discipline (SPEC §13 #30): every bid the student set, keywords and placements.
 *  Spotlight is left out: the platform bids for it. */
function bidDiscipline(input: SetupInputV2): ScoreLineV2 {
  const keywordBids = input.launched.flatMap((c) => c.keywords.map((k) => ({ term: k.term, bid: k.exactBid * (1 + (c.boostPct ?? 0)), max: keywordMaxCpm(input, k.term, c.skuIds) })));
  const placementBids = input.launched.flatMap((c) => (c.placements ?? [])
    .filter((pl) => input.ctx.market.placements.find((x) => x.id === pl.id)?.kind !== "spotlight")
    .map((pl) => ({ term: input.ctx.market.placements.find((x) => x.id === pl.id)?.label ?? pl.id, bid: pl.bid, max: placementMaxCpm(input, pl.id, c.skuIds) })));
  const bids = [...keywordBids, ...placementBids].filter((b) => b.max > 0);
  const within = bids.filter((b) => b.bid <= b.max * 1.05);
  const share = bids.length ? within.length / bids.length : 1;
  const worst = bids.filter((b) => b.bid > b.max * 1.05).sort((a, b) => b.bid / b.max - a.bid / a.max)[0];
  return line({
    key: "v2_bids", category: "setup", label: "Bid discipline", earned: 6 * share, max: 6,
    judgedOn: "Whether your bids (keywords, category pages, Stories feeds, Rec Ads slots, including any boost) stay at or below the most you can pay and still make money there (max profitable CPM). Spotlight is bid by the platform, so it isn't judged.",
    tiers: [{ points: 6, rule: "All bids at or below max profitable CPM (or nothing to judge)" }, { points: 0, rule: "None" }],
    note: !bids.length ? "No bids of yours to judge (Spotlight is bid by the platform)." : worst ? `${within.length} of ${bids.length} bids are safe; "${worst.term}" at ₹${Math.round(worst.bid)} is above its ₹${Math.round(worst.max)} max profitable CPM.` : "Every bid is at or below what a view is worth.",
    howToImprove: "Keep bid × (1 + boost) at or below max profitable CPM. You never pay more than your bid, so this keeps every ad sale profitable.",
  });
}

function structure(input: SetupInputV2): ScoreLineV2 {
  const traps = input.ctx.market.traps.filter((t) => t !== "creative");
  const camps = input.launched;
  const checks: Record<string, boolean> = {
    headLong: camps.some((c) => c.keywords.length > 0 && c.keywords.every((k) => input.ctx.market.keywords.find((m) => m.term === k.term)?.tier === "long")),
    hero: camps.some((c) => c.skuIds.length === 1) || camps.every((c) => c.skuIds.length < input.ctx.scenario.profile.skus.length),
    stateSplit: camps.some((c) => c.geography === "select_cities" && c.cities.length === 1),
  };
  const addressed = traps.filter((t) => checks[t]);
  const share = traps.length ? addressed.length / traps.length : 1;
  const names: Record<string, string> = { headLong: "long-tail keywords in their own campaign", hero: "a focused hero-SKU campaign", stateSplit: "a campaign for the best state" };
  return line({
    key: "v2_structure", category: "setup", label: "Campaign structure", earned: 6 * share, max: 6,
    judgedOn: "Whether you set up your campaigns to avoid this brand's traps. One shared budget gets split evenly, so your best parts don't get extra money unless they have their own campaign.",
    tiers: [{ points: 6, rule: "Every structural trap anticipated" }, { points: 0, rule: "None anticipated" }],
    note: traps.length === 0 ? "No structural traps for this brand." : `Anticipated ${addressed.length} of ${traps.length}: ${traps.map((t) => `${names[t] ?? t} ${checks[t] ? "✓" : "✗"}`).join(", ")}.`,
    howToImprove: "Give the parts that earn most their own campaign and budget: hero SKU, long-tail keywords, the best-converting state.",
  });
}

// ── Live optimisation (35) ───────────────────────────────────────────────────
// Decision moments 15 (at most 5 each), analysis to action 5, scaling winners 5,
// getting better 4, peak hours covered 3, steady hands 3 (SPEC §13 #35).

const INSIGHT_POINTS = 5;
const MOMENT_POINTS = SCORE_V2_MAX.live - INSIGHT_POINTS
  - LIVE_FACTOR_MAX.scaling - LIVE_FACTOR_MAX.improvement - LIVE_FACTOR_MAX.peak - LIVE_FACTOR_MAX.steady;
/** One moment can't carry more than this, so a single call doesn't decide the score. */
export const MOMENT_CAP = 5;

function insightLine(input: ScoreV2Input, detected: ReturnType<typeof detectMoments>): ScoreLineV2 {
  const s = scoreInsights(input.insights, detected, input.actions, INSIGHT_POINTS);
  return line({
    key: "v2_insights", category: "live", label: "Analysis to action", earned: s.earned, max: INSIGHT_POINTS,
    judgedOn: "Whether the insights you logged at the weekly checkpoints named real problems in the reports, and whether you acted on them.",
    tiers: [
      { points: INSIGHT_POINTS, rule: "Insights match real problems and you acted on them within 3 days" },
      { points: 3, rule: "Insights match real problems, no follow-up action" },
      { points: 0, rule: "No insights logged, or none matched the data" },
    ],
    note: s.note,
    howToImprove: "At each checkpoint, open the 'How to read this' sheet, find the worst number, log it with the report and figure, then make the change.",
  });
}

/** Moment points no moment claimed (SPEC §13 #29b): only a run that wasted little
 *  earns them, so a quiet run that lost money doesn't get them free. */
export function noMomentPoints(wastedShare: number, max: number): number {
  return max * (1 - Math.min(1, Math.max(0, wastedShare)));
}

function cleanRunLine(input: ScoreV2Input, max: number, momentCount: number): ScoreLineV2 {
  const wasted = wastedSpendShare(input.results, wasteFloorFor(input.ctx.scenario.profile.goalType));
  return line({
    key: "v2_moments", category: "live", label: momentCount ? "Clean running" : "Decision moments", earned: noMomentPoints(wasted, max), max,
    judgedOn: momentCount
      ? "The moment points no moment used, earned by how little of your spend was wasted (spent where ads lost money)."
      : "How well you responded each time the data called for action. With no moment to answer, how little of your spend was wasted (spent where ads lost money).",
    tiers: [
      { points: max, rule: "No spend wasted" },
      { points: 0, rule: "All spend wasted" },
    ],
    note: `${momentCount ? `Only ${momentCount} moment${momentCount === 1 ? "" : "s"} came up.` : "No single moment called for a change."} ${Math.round(wasted * 100)}% of your spend went where ads lost money.`,
    howToImprove: wasted > 0.1 ? "Check the Keywords tab every few days: lower or pause anything whose ROAS sits below break-even." : "Nothing to fix here.",
  });
}

function momentLines(input: ScoreV2Input, detected: ReturnType<typeof detectMoments>): { lines: ScoreLineV2[]; moments: MomentScore[] } {
  const each = detected.length ? Math.min(MOMENT_CAP, MOMENT_POINTS / detected.length) : 0;
  const scored = detected.map((m) => scoreMoment({ ctx: input.ctx, launched: input.launched, actions: input.actions, statesByDay: input.statesByDay, stepOptions: input.stepOptions }, m, each, input.describeAction));
  const lines = scored.map((s, i) => line({
    key: `v2_moment_${i + 1}`, category: "live", label: `Day ${s.moment.day}: ${s.moment.title}`, earned: s.points, max: each,
    judgedOn: s.moment.evidence,
    tiers: [
      { points: each, rule: "Your change gained ≥ 60% of what the best lever would (or nothing was needed and you didn't make it worse)" },
      { points: round1(each / 2), rule: "Partial gain, or acted late" },
      { points: 0, rule: "Ignored, or your change lost money vs doing nothing" },
    ],
    note: s.verdict === "right" ? `Right call: ${s.studentAction}.`
      : s.verdict === "partial" ? `Partly right: ${s.studentAction}. "${s.bestLever}" would have gained more.`
      : s.verdict === "wrong" ? `This made it worse: ${s.studentAction ?? "your changes"}.`
      : s.verdict === "nothingNeeded" ? "Holding steady was right here."
      : `No response within ${s.moment.window} days. "${s.bestLever}" would have helped.`,
    howToImprove: `Best lever here: ${s.bestLever}.`,
  }));
  const leftover = round1(MOMENT_POINTS - each * detected.length);
  return { moments: scored, lines: leftover > 0 ? [...lines, cleanRunLine(input, leftover, detected.length)] : lines };
}

function liveLines(input: ScoreV2Input): { lines: ScoreLineV2[]; moments: MomentScore[] } {
  const detected = detectMoments({ ctx: input.ctx, results: input.results, configsByDay: input.configsByDay });
  const moments = momentLines(input, detected);
  return {
    moments: moments.moments,
    lines: [insightLine(input, detected), ...moments.lines, scalingLine(input), improvementLine(input), peakLine(input), steadyLine(input)],
  };
}

// ── Events + Rohit (20) ──────────────────────────────────────────────────────

function pacingLine(input: ScoreV2Input): ScoreLineV2 {
  const totalDays = input.ctx.totalDays;
  const daily = input.results.map((r) => sumMetrics(r.cells).spend);
  const darkFrom = daily.findIndex((s, i) => s === 0 && daily.slice(i).every((x) => x === 0) && daily.slice(0, i).some((x) => x > 0));
  const ranOutEarly = darkFrom >= 0 && darkFrom + 1 < totalDays - 1;
  const earned = ranOutEarly ? (darkFrom + 1 >= totalDays - 5 ? 2.5 : 0) : 5;
  return line({
    key: "v2_pacing", category: "eventsRohit", label: "Budget pacing", earned, max: 5,
    judgedOn: "Whether the money lasted the whole run (a too-high daily budget burns the account early).",
    tiers: [{ points: 5, rule: "Ads ran to the end" }, { points: 2.5, rule: "Ran out in the last 5 days" }, { points: 0, rule: "Ran out earlier" }],
    note: ranOutEarly ? `Spend stopped on day ${darkFrom + 1}; the last ${totalDays - darkFrom} days had no ads.` : "Ads ran through to the end of the run.",
    howToImprove: "Watch the pacing alert: lower daily budgets or bids, or use an overall budget, so money lasts to day 30.",
  });
}

const FIT_FULL = 0.9;
const FIT_ZERO = 0.5;
const FAIR_TRADE = 0.85;
const OK_TRADE = 0.6;
const DISCOUNT_LOSS_CAP = 0.5;
const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** v2 opening deal (SPEC §6.1): 2.5 for stock fit, 2.5 for what the student got for what they gave. */
export function dealLine(ctx: MarketContext, deal: OpeningDeal): ScoreLineV2 {
  const terms = deal.terms.walkedAway ? { ...deal.terms, stock: briefStock(ctx) } : deal.terms;
  const fit = stockFit(ctx, terms);
  const fitPts = 2.5 * clamp((fit - FIT_ZERO) / (FIT_FULL - FIT_ZERO), 0, 1);
  const got = deal.terms.walkedAway ? 0 : valueAsked(ctx, terms);
  const gave = deal.terms.walkedAway ? 0 : valueGiven(ctx, terms);
  const skus = new Map(ctx.scenario.profile.skus.map((x) => [x.id, x]));
  const losing = terms.gives.flatMap((g) => g.kind !== "discount" ? [] : g.skuIds
    .map((id) => skus.get(id)!)
    .filter((sku) => sku && Math.round(sku.mrp * g.pct) >= sku.margin)
    .map((sku) => ({ sku, off: Math.round(sku.mrp * g.pct) })));
  const efficiency = gave > 0 ? got / gave : 0;
  const tradeRaw = deal.terms.walkedAway || (got === 0 && gave === 0) ? 1
    : got === 0 ? 0
    : efficiency >= FAIR_TRADE ? 2.5 : efficiency >= OK_TRADE ? 1.5 : 0.5;
  const tradePts = losing.length ? Math.min(tradeRaw, DISCOUNT_LOSS_CAP) : tradeRaw;
  const tradeNote = deal.terms.walkedAway ? "You walked away, so you kept the brief's terms: safe, but nothing gained."
    : got === 0 && gave === 0 ? "No extras either way."
    : got === 0 ? `You offered ${rupee(gave)} of value and asked for nothing back.`
    : `You got ${rupee(got)} of value from Rohit for ${rupee(gave)} of offers.`;
  const lossNote = losing.length ? ` Your discount on ${losing[0].sku.name} is ${rupee(losing[0].off)} a unit, but you only keep ${rupee(losing[0].sku.margin)}: every discounted sale loses money.` : "";
  return line({
    key: "v2_rohit", category: "eventsRohit", label: "Deal with Rohit", earned: fitPts + tradePts, max: 5,
    judgedOn: "Two things: did you put your stock where people search (2.5), and did you get fair value for what you offered Rohit (2.5)?",
    tiers: [
      { points: 5, rule: "Stock follows searches (90% or better) and you got at least 85% of the value you gave" },
      { points: 3.5, rule: "Stock follows searches, and you walked away or kept it simple" },
      { points: 2.5, rule: "Good stock, but you gave value for nothing back" },
      { points: 0, rule: "Stock where few people search, and a one-sided trade" },
    ],
    note: `Stock where people search: ${Math.round(fit * 100)}%. ${tradeNote}${lossNote}`,
    howToImprove: "Place stock in proportion to each state's searches, ask only for what helps your plan, and never fund a discount bigger than what you keep per unit.",
  });
}

function rohitLine(input: ScoreV2Input): ScoreLineV2 {
  if (input.deal) return dealLine(input.ctx, input.deal);
  const share = input.pitch && input.pitch.max > 0 ? input.pitch.score / input.pitch.max : 0;
  return line({
    key: "v2_rohit", category: "eventsRohit", label: "Pitch to Rohit", earned: 5 * share, max: 5,
    judgedOn: "How well you convinced Rohit, the category manager, using real numbers (stock, sales speed, profit) instead of promises.",
    tiers: [{ points: 5, rule: "Strong, data-backed pitch" }, { points: 0, rule: "Pitch not made or rejected" }],
    note: input.pitch ? `Pitch score ${input.pitch.score} of ${input.pitch.max}.` : "No pitch recorded.",
    howToImprove: "Lead with the numbers Rohit cares about and commit only to what your stock can deliver.",
  });
}

const VERDICT_TEXT = { right: "right move", held: "held steady (right here)", other: "changed something else", none: "no change in time" } as const;

function eventsLine(input: ScoreV2Input): ScoreLineV2 {
  const alerts = input.alerts ?? [];
  const { items, share } = scoreEventResponses(alerts, input.actions, input.launched, input.ctx, input.stepOptions?.adjustments);
  return line({
    key: "v2_events", category: "eventsRohit", label: "Response to alerts", earned: 5 * share, max: 5,
    judgedOn: "Each alert that stopped the clock had a few right moves. Did you make one before its decision window closed?",
    tiers: [{ points: 5, rule: "A right move for every alert, in time" }, { points: 2, rule: "You changed something, but not a right move" }, { points: 0, rule: "No change in time" }],
    note: items.length === 0
      ? "No alert needed a response in this run."
      : items.map((i) => `Day ${i.activation.raisedAfterDay}, ${i.activation.title}: ${VERDICT_TEXT[i.verdict]}`).join(". ") + ".",
    howToImprove: "When an alert stops the clock, open the report it points to, then make one of the changes it suggests before the window closes.",
  });
}

function checkInsLine(input: ScoreV2Input): ScoreLineV2 {
  const replies = input.rohit?.replies ?? [];
  const resolved = (input.rohit?.commitments ?? []).filter((c) => c.status !== "pending");
  const none = replies.length === 0;
  const quality = none ? 1 : replies.reduce((s, r) => s + ROHIT_QUALITY_SHARE[r.quality], 0) / replies.length;
  const kept = resolved.length === 0 ? 1 : resolved.filter((c) => c.status === "kept").length / resolved.length;
  const brokenText = resolved.filter((c) => c.status === "broken").map((c) => c.commitment.text);
  return line({
    key: "v2_checkins", category: "eventsRohit", label: "Rohit check-ins", earned: 5 * (0.6 * quality + 0.4 * kept), max: 5,
    judgedOn: "How you answered Rohit during the run (replies backed by data score best) and whether you kept what you promised.",
    tiers: [{ points: 5, rule: "Data-backed replies and every promise kept" }, { points: 3, rule: "Mixed replies or a broken promise" }, { points: 1, rule: "Weak replies and broken promises" }],
    note: none
      ? "Rohit did not need to check in with you during the run."
      : `${replies.length} check-in${replies.length > 1 ? "s" : ""}; ${resolved.length ? `${resolved.length - brokenText.length} of ${resolved.length} promises kept` : "no promises due yet"}${brokenText.length ? ` (broken: ${brokenText.join("; ")})` : ""}.`,
    howToImprove: "Pick replies that cite the numbers Rohit shows you, and only promise what your stock and budget can deliver.",
  });
}

// ── Results (20) ─────────────────────────────────────────────────────────────

function goalActual(label: string, m: Metrics): number | null {
  switch (label) {
    case "ROAS": case "Minimum ROAS": return m.roas;
    case "Units sold": case "Units": case "Reduce aging units": return m.units;
    case "Impressions": return m.viewableImpressions;
    case "Reach": return m.viewableImpressions * 0.6;
    case "CTR": return m.ctr * 100;
    case "CVR": return m.cvr * 100;
    default: return null;
  }
}

export interface GoalRowV2 { label: string; goal: number; actual: number; unit: string; pct: number }

/** Each goal counts up to 100%: beating one goal can't make up for missing another. */
const GOAL_CAP = 1;

/** Average achievement across goals, each capped at 100% (ratios of actual to target). */
export function goalAchievement(ratios: readonly number[]): number {
  return ratios.length ? ratios.reduce((s, r) => s + Math.min(GOAL_CAP, Math.max(0, r)), 0) / ratios.length : 0;
}

/** Each measurable client goal with the run's actual value; pct is capped at 100. */
export function goalRowsV2(ctx: MarketContext, run: Metrics): GoalRowV2[] {
  return clientGoalsV2(ctx.scenario).metrics
    .map((g) => ({ g, actual: goalActual(g.label, run) }))
    .filter((r): r is { g: typeof r.g; actual: number } => r.actual !== null && r.g.target > 0)
    .map(({ g, actual }) => ({ label: g.label, goal: g.target, actual, unit: g.unit, pct: Math.round(Math.min(GOAL_CAP, actual / g.target) * 100) }));
}

function goalsLine(input: ScoreV2Input, run: Metrics): ScoreLineV2 {
  const rows = clientGoalsV2(input.ctx.scenario).metrics
    .map((g) => ({ g, actual: goalActual(g.label, run) }))
    .filter((r): r is { g: typeof r.g; actual: number } => r.actual !== null && r.g.target > 0);
  const achievement = goalAchievement(rows.map((r) => r.actual / r.g.target));
  const earned = achievement >= 0.9 ? 10 : achievement >= 0.7 ? 7 : achievement >= 0.5 ? 4 : rows.length ? 1 : 0;
  return line({
    key: "v2_goals", category: "results", label: "Client goals", earned, max: 10,
    judgedOn: "How close you got to the client's goals, on average. Each goal counts up to 100%, so beating one can't make up for missing another.",
    tiers: [{ points: 10, rule: "≥ 90%" }, { points: 7, rule: "≥ 70%" }, { points: 4, rule: "≥ 50%" }, { points: 1, rule: "< 50%" }],
    note: rows.length ? `${Math.round(achievement * 100)}% average: ${rows.map((r) => `${r.g.label} ${Math.round(Math.min(GOAL_CAP, r.actual / r.g.target) * 100)}%${r.actual > r.g.target ? " (beaten)" : ""}`).join(", ")}.` : "No measurable client goals.",
    howToImprove: "Plan the run backwards from the client goals and check them at each weekly checkpoint.",
  });
}

function profitLine(run: Metrics): ScoreLineV2 {
  const ratio = run.breakEvenRoas > 0 ? run.roas / run.breakEvenRoas : 0;
  const earned = ratio >= 1.1 ? 5 : ratio >= 1 ? 3 : ratio >= 0.8 ? 1 : 0;
  return line({
    key: "v2_profit", category: "results", label: "ROAS vs break-even", earned, max: 5,
    judgedOn: "Whether the ads made money. ROAS is sales for every ₹1 of ads; break-even is the ROAS you need just to not lose money.",
    tiers: [{ points: 5, rule: "≥ 1.1× break-even" }, { points: 3, rule: "≥ break-even" }, { points: 1, rule: "≥ 0.8× break-even" }, { points: 0, rule: "Below" }],
    note: `ROAS ${run.roas.toFixed(2)} vs break-even ${run.breakEvenRoas.toFixed(2)} (profit after ads ₹${Math.round(run.profit).toLocaleString("en-IN")}).`,
    howToImprove: "Cut spend that sits below break-even and move it to what earns most per click.",
  });
}

/** F14: share of spend where ads lost money on the goal (helpers in liveFactors.ts). */
function wasteLine(results: readonly DayResult[], goalType: string): ScoreLineV2 {
  const floor = wasteFloorFor(goalType);
  const share = wastedSpendShare(results, floor);
  const earned = share <= 0.1 ? 5 : share <= 0.25 ? 3 : share <= 0.4 ? 1 : 0;
  return line({
    key: "v2_waste", category: "results", label: "Wasted spend", earned, max: 5,
    judgedOn: "How much of your money went to keywords and hours that lost money over the run. Spending less is fine; spending on losers is not.",
    tiers: [{ points: 5, rule: "≤ 10% wasted" }, { points: 3, rule: "≤ 25%" }, { points: 1, rule: "≤ 40%" }, { points: 0, rule: "More" }],
    note: floor < 1
      ? `${Math.round(share * 100)}% of spend went where ads earned back less than ${Math.round(floor * 100)}% of their cost (the limit for this brand's reach goal).`
      : `${Math.round(share * 100)}% of spend went to keyword × hour combinations below break-even.`,
    howToImprove: "Use the keyword and hour-of-day reports to find spend below break-even and cut it.",
  });
}

/** The four setup lines (25 points), before any day has run (setup score card). */
export function scoreSetupV2(input: SetupInputV2): ScoreLineV2[] {
  return [formatFit(input), keywordChoice(input), bidDiscipline(input), structure(input)];
}


export interface CostlyMistake { title: string; lost: number; what: string; unit: ObjectiveUnit }

const MISTAKE_LIMIT = 3;

/**
 * The biggest misses, worst first. Overlapping moments on one campaign replay the
 * same days, so a repeat with the same best lever and loss is dropped.
 */
export function pickCostliest(moments: readonly MomentScore[], unit: ObjectiveUnit): CostlyMistake[] {
  const missed = moments
    .filter((m) => m.verdict === "wrong" || m.verdict === "ignored" || m.verdict === "partial")
    .map((m) => ({ m, lost: m.bestGainVsNothing - m.gainVsNothing }))
    .filter(({ lost }) => lost > 0)
    .sort((a, b) => b.lost - a.lost);
  const seen = new Set<string>();
  return missed.flatMap(({ m, lost }) => {
    const key = `${m.moment.campaignId}|${m.bestLever}|${Math.round(lost)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ title: `Day ${m.moment.day}: ${m.moment.title}`, lost, what: m.studentAction ?? "No action", unit }];
  }).slice(0, MISTAKE_LIMIT);
}

export function scoreRunV2(input: ScoreV2Input): ScoreV2 {
  const run = sumMetrics(input.results.flatMap((r) => r.cells));
  const goalRows = goalRowsV2(input.ctx, run);
  const live = liveLines(input);
  const lines = [
    ...scoreSetupV2(input),
    ...live.lines,
    pacingLine(input), rohitLine(input), eventsLine(input), checkInsLine(input),
    goalsLine(input, run), profitLine(run), wasteLine(input.results, input.ctx.scenario.profile.goalType),
  ];
  const totals = (Object.keys(SCORE_V2_MAX) as CategoryV2[]).reduce((acc, k) => ({
    ...acc, [k]: round1(lines.filter((l) => l.category === k).reduce((s, l) => s + l.earned, 0)),
  }), {} as Record<CategoryV2, number>);
  const costliestMistakes = pickCostliest(live.moments, objectiveUnit(input.ctx.scenario.profile.goalType));
  return {
    version: 2, lines, totals,
    grandTotal: round1(Object.values(totals).reduce((s, x) => s + x, 0)),
    moments: live.moments, costliestMistakes, run,
    goalRows, achievementPct: Math.round(goalAchievement(goalRows.map((r) => r.actual / r.goal)) * 100),
  };
}
