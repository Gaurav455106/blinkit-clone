// ── Live optimisation factors beyond decision moments (SPEC §8, decision #35) ──
// Each factor reads only the run's own data (daily cells, configs, the action
// log), so it marks what the student did with what the engine actually showed:
//   scaling winners    did they push money into what was earning and short of views
//   getting better     did wasted spend fall from week 1 to the last two weeks
//   peak hours         did budget-capped campaigns still cover the busiest hours
//   steady hands       did they avoid flip-flopping the same setting

import type { CampaignConfig, DayResult, MarketContext } from "@/market/engineTypes";
import type { LiveAction } from "@/market/actions";
import type { ScoreLineV2 } from "@/market/scoringV2";
import { byUnit, sumMetrics } from "@/market/aggregate";
import { lossFloorFor } from "@/market/moments";
import { peakSlotOf } from "@/market/momentHelpers";
import { line, round1 } from "@/market/scoreLine";

export interface LiveFactorInput {
  ctx: MarketContext;
  actions: readonly LiveAction[];
  results: readonly DayResult[];
  configsByDay: readonly (readonly CampaignConfig[])[];
}

/** Words for advice that match what the account actually ran, so a Spotlight-only
 *  account is not told to check its keywords. */
export interface AdviceWords {
  /** Where to make the change on the live dashboard. */
  tab: string;
  /** Which reports show it. */
  reports: string;
  /** What gets cut or scaled: "keyword", "placement" or "keyword or placement". */
  things: string;
}

export function adviceWords(results: readonly DayResult[]): AdviceWords {
  const has = (keyword: boolean) => results.some((r) => r.cells.some((c) => (c.inventory === "keyword") === keyword));
  const keywords = has(true);
  const placements = has(false);
  if (keywords && placements) return { tab: "the Keywords and Campaigns tabs", reports: "R2 Keyword, R6 Placement and R5 Hour of day reports", things: "keyword or placement" };
  if (placements) return { tab: "the Campaigns tab", reports: "R6 Placement and R5 Hour of day reports", things: "placement" };
  return { tab: "the Keywords tab", reports: "R2 Keyword and R5 Hour of day reports", things: "keyword" };
}

export const LIVE_FACTOR_MAX = { scaling: 5, improvement: 4, peak: 3, steady: 3 } as const;

const pct = (x: number) => `${Math.round(x * 100)}%`;

// ── Wasted spend (shared with the results line) ──────────────────────────────

/** Contribution ÷ spend below which spend counts as wasted, by goal (SPEC §14 F13). */
export function wasteFloorFor(goalType: string): number {
  return lossFloorFor(goalType);
}

/** F14: share of spend in campaign × keyword × slot cells whose contribution fell below spend × floor. */
export function wastedSpendShare(results: readonly DayResult[], floor = 1): number {
  const cells = new Map<string, { spend: number; contribution: number }>();
  let total = 0;
  for (const r of results) {
    for (const c of r.cells) {
      const key = `${c.campaignId}|${c.term}|${c.slot}`;
      const acc = cells.get(key) ?? { spend: 0, contribution: 0 };
      cells.set(key, { spend: acc.spend + c.spend, contribution: acc.contribution + c.contribution });
      total += c.spend;
    }
  }
  let wasted = 0;
  for (const c of cells.values()) if (c.contribution < c.spend * floor) wasted += c.spend;
  return total > 0 ? wasted / total : 0;
}

// ── Scaling winners (5) ───────────────────────────────────────────────────────

/** A keyword or placement earning ≥ 1.2× the goal's floor while losing ≥ 25% of its searches to rank or budget. */
const WIN_MARGIN = 1.2;
const HEADROOM = 0.25;
const MIN_DAILY_SPEND = 150;
/** Days the student has to scale a winner. */
export const SCALE_WINDOW = 5;
const MAX_WINNERS = 6;

export interface Winner {
  day: number;
  campaignId: string;
  term: string;
  bid: number;
  budget: number;
  roas: number;
  headroom: number;
  /** What held it back: the campaign's budget, or its bid (rank). */
  cause: "budget" | "rank";
}

const bidOf = (cfg: CampaignConfig, term: string) =>
  cfg.keywords.find((k) => k.term === term)?.exactBid ?? cfg.placements?.find((p) => p.id === term)?.bid ?? 0;

/** Winners in the run, each counted once on its first day, earliest first. */
export function findWinners(input: LiveFactorInput): Winner[] {
  const floor = lossFloorFor(input.ctx.scenario.profile.goalType);
  const seen = new Set<string>();
  const found: Winner[] = [];
  for (let day = 3; day <= input.ctx.totalDays - SCALE_WINDOW; day++) {
    const recent = input.results.filter((r) => r.day > day - 3 && r.day <= day);
    if (recent.length < 3) continue;
    for (const cfg of input.configsByDay[day - 1] ?? []) {
      if (cfg.paused) continue;
      const cells = recent.flatMap((r) => r.cells.filter((c) => c.campaignId === cfg.id));
      for (const u of byUnit(cells)) {
        const key = `${cfg.id}|${u.key}`;
        if (seen.has(key) || u.searches <= 0 || u.spend / 3 < MIN_DAILY_SPEND) continue;
        const headroom = (u.lostToRank + u.lostToBudget) / u.searches;
        if (u.contribution < u.spend * floor * WIN_MARGIN || headroom < HEADROOM) continue;
        seen.add(key);
        found.push({ day, campaignId: cfg.id, term: u.key, bid: bidOf(cfg, u.key), budget: cfg.budget, roas: u.roas, headroom, cause: u.lostToBudget > u.lostToRank ? "budget" : "rank" });
      }
    }
  }
  return found.slice(0, MAX_WINNERS);
}

/** True when, within the window, the student pulled the lever that was holding the winner back:
 *  more budget when the budget ran out (a higher bid would only spend it faster), a higher bid
 *  when it lost on rank. */
export function wasScaled(w: Winner, actions: readonly LiveAction[]): boolean {
  return actions.some((a) => {
    if (a.campaignId !== w.campaignId || a.dayMade < w.day || a.dayMade > w.day + SCALE_WINDOW) return false;
    const ch = a.change;
    if (w.cause === "budget") return ch.kind === "budget" && ch.budget > w.budget;
    if (ch.kind === "keywordBid") return ch.term === w.term && ch.bid > w.bid;
    if (ch.kind === "placementBid") return ch.id === w.term && ch.bid > w.bid;
    return false;
  });
}

/** A keyword as typed, or a placement's readable name ("Spotlight: search results"). */
const unitLabel = (input: LiveFactorInput, term: string): string =>
  input.ctx.market.placements.find((p) => p.id === term)?.label ?? term;

export function scalingLine(input: LiveFactorInput): ScoreLineV2 {
  const max = LIVE_FACTOR_MAX.scaling;
  const winners = findWinners(input);
  const scaled = winners.filter((w) => wasScaled(w, input.actions));
  const share = winners.length ? scaled.length / winners.length : 1;
  const missed = winners.filter((w) => !scaled.includes(w));
  return line({
    key: "v2_scaling", category: "live", label: "Scaling winners", earned: max * share, max,
    judgedOn: `Keywords and placements that earned well but lost at least ${pct(HEADROOM)} of their searches: within ${SCALE_WINDOW} days, did you raise the budget (if the budget ran out) or the bid (if it lost on rank)?`,
    tiers: [
      { points: max, rule: "Every winner was scaled in time (or nothing was worth scaling)" },
      { points: round1(max / 2), rule: "Half the winners scaled" },
      { points: 0, rule: "No winner scaled" },
    ],
    note: winners.length === 0
      ? "Nothing was both earning well and short of views, so there was nothing to scale."
      : `Scaled ${scaled.length} of ${winners.length}.${missed.length ? ` Missed: ${missed.slice(0, 3).map((w) => `"${unitLabel(input, w.term)}" (on day ${w.day} its last 3 days ran at ROAS ${w.roas.toFixed(2)} and missed ${pct(w.headroom)} of searches; it needed ${w.cause === "budget" ? "more budget" : "a higher bid"})`).join(", ")}.` : ""}`,
    howToImprove: `Every few days, sort ${adviceWords(input.results).tab} by ROAS. Any ${adviceWords(input.results).things} well above break-even that misses searches needs more budget if 'lost to budget' is high, or a higher bid if 'lost to rank' is high.`,
  });
}

// ── Getting better (4) ───────────────────────────────────────────────────────

/** Late-run waste at or under this share counts as clean. */
const CLEAN_WASTE = 0.1;
const EARLY_DAYS = 7;
const LATE_FROM = 15;

export function improvementLine(input: LiveFactorInput): ScoreLineV2 {
  const max = LIVE_FACTOR_MAX.improvement;
  const floor = wasteFloorFor(input.ctx.scenario.profile.goalType);
  const early = wastedSpendShare(input.results.filter((r) => r.day <= EARLY_DAYS), floor);
  const lateDays = input.results.filter((r) => r.day >= LATE_FROM);
  const late = wastedSpendShare(lateDays, floor);
  const lateSpend = sumMetrics(lateDays.flatMap((r) => r.cells)).spend;
  // Clean late (or no late spend to judge) is full marks; otherwise credit for halving week-1 waste
  const earned = lateSpend <= 0 || late <= CLEAN_WASTE ? max
    : early <= late ? 0
    : max * Math.min(1, (early - late) / (early * 0.5));
  return line({
    key: "v2_improvement", category: "live", label: "Getting better", earned, max,
    judgedOn: `Wasted spend (spend where ads lost money on your goal) in days 1 to ${EARLY_DAYS} against days ${LATE_FROM} to ${input.ctx.totalDays}.`,
    tiers: [
      { points: max, rule: `Late waste ${pct(CLEAN_WASTE)} or less, or week-1 waste at least halved` },
      { points: round1(max / 2), rule: "Week-1 waste cut by a quarter" },
      { points: 0, rule: "Waste stayed the same or grew" },
    ],
    note: lateSpend <= 0 ? "No spend in the second half to judge." : `Wasted spend went from ${pct(early)} in week 1 to ${pct(late)} from day ${LATE_FROM}.`,
    howToImprove: "Use each weekly checkpoint to cut one source of waste: a keyword, hour, state or placement whose ROAS sits below break-even.",
  });
}

// ── Peak hours covered (3) ───────────────────────────────────────────────────

/** A campaign losing more than this share of searches to budget counts as budget-capped. */
const CAPPED = 0.2;
/** Peak-slot coverage at or above this earns full marks. */
const PEAK_FULL = 0.8;

export function peakLine(input: LiveFactorInput): ScoreLineV2 {
  const max = LIVE_FACTOR_MAX.peak;
  const peak = peakSlotOf(input.ctx);
  const late = input.results.filter((r) => r.day >= LATE_FROM);
  const ids = [...new Set(late.flatMap((r) => r.cells.map((c) => c.campaignId)))];
  const capped = ids
    .map((id) => {
      const cells = late.flatMap((r) => r.cells.filter((c) => c.campaignId === id));
      const all = sumMetrics(cells);
      const atPeak = sumMetrics(cells.filter((c) => c.slot === peak));
      return { id, spend: all.spend, cappedShare: all.searches > 0 ? all.lostToBudget / all.searches : 0, coverage: atPeak.searches > 0 ? 1 - atPeak.lostToBudget / atPeak.searches : 1 };
    })
    .filter((c) => c.cappedShare > CAPPED && c.spend > 0);
  const totalSpend = capped.reduce((s, c) => s + c.spend, 0);
  const coverage = totalSpend > 0 ? capped.reduce((s, c) => s + c.coverage * c.spend, 0) / totalSpend : 1;
  return line({
    key: "v2_peak", category: "live", label: "Peak hours covered", earned: max * Math.min(1, coverage / PEAK_FULL), max,
    judgedOn: `For campaigns whose budget ran out (more than ${pct(CAPPED)} of searches lost to budget, from day ${LATE_FROM}): how much of the busiest hour they still covered.`,
    tiers: [
      { points: max, rule: `Peak hour ${pct(PEAK_FULL)} covered or more, or no campaign ran out of budget` },
      { points: round1(max / 2), rule: `About ${pct(PEAK_FULL / 2)} covered` },
      { points: 0, rule: "Budget gone before the peak hour" },
    ],
    note: capped.length === 0 ? "No campaign ran short of budget, so every hour was covered." : `Budget-capped campaigns covered ${pct(coverage)} of searches in the busiest hour.`,
    howToImprove: "When budget runs out early, switch off the quiet night hours in the ad schedule, or raise the budget, so money is left for the busy evening.",
  });
}

// ── Steady hands (3) ─────────────────────────────────────────────────────────

/** Changing the same setting more than this many times within FLIP_DAYS counts as flip-flopping. */
const FLIP_LIMIT = 2;
const FLIP_DAYS = 3;

const subjectOf = (a: LiveAction): string => {
  const ch = a.change;
  const what = "term" in ch ? ch.term : "id" in ch ? ch.id : ch.kind;
  return `${a.campaignId}|${ch.kind === "addKeyword" ? "keywordBid" : ch.kind}|${what}`;
};

/** Settings changed more than FLIP_LIMIT times within FLIP_DAYS days. */
export function flipFlops(actions: readonly LiveAction[]): string[] {
  const bySubject = new Map<string, number[]>();
  for (const a of actions) bySubject.set(subjectOf(a), [...(bySubject.get(subjectOf(a)) ?? []), a.dayMade]);
  return [...bySubject.entries()]
    .filter(([, days]) => {
      const sorted = [...days].sort((x, y) => x - y);
      return sorted.some((d, i) => sorted.filter((x, j) => j >= i && x < d + FLIP_DAYS).length > FLIP_LIMIT);
    })
    .map(([subject]) => subject);
}

const SETTING_WORDS: Record<string, string> = {
  keywordBid: "the bid on", smartBid: "the smart bid on", pauseKeyword: "pausing", placementBid: "the bid on",
  budget: "a campaign budget", states: "a campaign's states", schedule: "a campaign's hours", pause: "pausing a campaign",
};

/** "the bid on Spotlight: search results" from a flip-flop subject (campaign|kind|what). */
function settingName(input: LiveFactorInput, subject: string): string {
  const [, kind, what] = subject.split("|");
  const words = SETTING_WORDS[kind] ?? kind;
  return what === kind ? words : `${words} "${unitLabel(input, what)}"`;
}

export function steadyLine(input: LiveFactorInput): ScoreLineV2 {
  const max = LIVE_FACTOR_MAX.steady;
  const flips = flipFlops(input.actions);
  const names = flips.map((s) => settingName(input, s));
  return line({
    key: "v2_steady", category: "live", label: "Steady hands", earned: max - flips.length, max,
    judgedOn: `Whether you gave changes time to show results: the same setting changed more than ${FLIP_LIMIT} times in ${FLIP_DAYS} days costs 1 point.`,
    tiers: [
      { points: max, rule: "No setting flip-flopped" },
      { points: max - 1, rule: "One setting flip-flopped" },
      { points: 0, rule: `${max} or more settings flip-flopped` },
    ],
    note: flips.length === 0 ? "You gave each change time to work." : `Changed too often: ${names.slice(0, 3).join(", ")}.`,
    howToImprove: "After a change, wait 2 to 3 days of data before changing the same setting again. A day's numbers are noisy.",
  });
}
