// ── Decision moments + counterfactual scoring (SPEC §8, §14 F13) ──────────────
// The engine logs each moment an expert would act. Each moment is scored by
// replaying its window three ways from the stored state: with the student's
// actions, with no action, and with the best of a few candidate levers. Points
// follow the gain on the brand's goal, so every lever that works is accepted.

import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { applyActions, type ActionChange, type LiveAction } from "@/market/actions";
import { stepDay, type StepOptions } from "@/market/step";
import { sumMetrics, byUnit, byState, bySku, type Metrics } from "@/market/aggregate";
import { peakSlotOf } from "@/market/momentHelpers";

export type MomentType = "sovDrop" | "budgetCapPeak" | "belowBreakEven" | "headTakesMoney" | "heroStarved" | "stateStarved";

export interface Moment {
  id: string;
  type: MomentType;
  /** First day the condition was visible (the student can act from this day). */
  day: number;
  campaignId: string;
  /** Keyword, state or SKU the moment is about. */
  subject: string;
  title: string;
  /** What the data showed, with numbers. */
  evidence: string;
  /** Days the student has to respond. */
  window: number;
  /** Candidate levers an expert might pull (made on `day`). */
  levers: readonly { label: string; change: ActionChange }[];
}

const WINDOW = 3;
const HORIZON_EXTRA = 4;
/** SPEC §13 #1: about 6–8 decision moments per run. */
export const MAX_MOMENTS = 8;
const MIN_DAILY_SPEND = 150;

const cellsOf = (r: DayResult, campaignId: string) => r.cells.filter((c) => c.campaignId === campaignId);
const lastN = (results: readonly DayResult[], day: number, n: number) => results.filter((r) => r.day > day - n && r.day <= day);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const rupees = (x: number) => `₹${Math.round(x).toLocaleString("en-IN")}`;

interface DetectInput {
  ctx: MarketContext;
  results: readonly DayResult[];
  configsByDay: readonly (readonly CampaignConfig[])[];
}

type Candidate = Omit<Moment, "id" | "window">;

function detectForDay(input: DetectInput, day: number): Candidate[] {
  const { ctx, results, configsByDay } = input;
  const configs = configsByDay[day - 1] ?? [];
  const recent3 = lastN(results, day, 3);
  if (recent3.length < 3) return [];
  const found: Candidate[] = [];

  for (const cfg of configs) {
    const recentCells = recent3.flatMap((r) => cellsOf(r, cfg.id));
    if (recentCells.length === 0) continue;
    const campaign = sumMetrics(recentCells);
    const capped = campaign.searches > 0 && campaign.lostToBudget / campaign.searches > 0.3;

    // Profitable keyword losing its slot: IS lost to rank jumped vs the 3 days before
    const prior3 = lastN(results, day - 3, 3).flatMap((r) => cellsOf(r, cfg.id));
    for (const k of cfg.keywords) {
      const now = sumMetrics(recentCells.filter((c) => c.term === k.term));
      const before = sumMetrics(prior3.filter((c) => c.term === k.term));
      if (now.searches <= 0 || before.searches <= 0) continue;
      const rankLossNow = now.lostToRank / now.searches;
      const rankLossBefore = before.lostToRank / before.searches;
      if (rankLossNow - rankLossBefore >= 0.2 && before.roas >= before.breakEvenRoas && before.spend > 0) {
        const target = Math.round(Math.max(k.exactBid * 1.2, Math.min(before.maxProfitableCpm, k.exactBid * 1.5)));
        found.push({
          type: "sovDrop", day, campaignId: cfg.id, subject: k.term,
          title: `Lost visibility on "${k.term}"`,
          evidence: `IS lost to rank rose from ${pct(rankLossBefore)} to ${pct(rankLossNow)}; ROAS had been ${before.roas.toFixed(2)} vs break-even ${before.breakEvenRoas.toFixed(2)}.`,
          levers: [
            { label: `Raise bid to ${rupees(target)}`, change: { kind: "keywordBid", term: k.term, bid: target } },
            { label: `Raise bid 25%`, change: { kind: "keywordBid", term: k.term, bid: Math.round(k.exactBid * 1.25) } },
          ],
        });
      }
      if (now.spend / 3 >= MIN_DAILY_SPEND && now.contribution < now.spend) {
        found.push({
          type: "belowBreakEven", day, campaignId: cfg.id, subject: k.term,
          title: `"${k.term}" is losing money`,
          evidence: `3-day ROAS ${now.roas.toFixed(2)} vs break-even ${now.breakEvenRoas.toFixed(2)} on ${rupees(now.spend)} spend; max profitable CPM ${rupees(now.maxProfitableCpm)} vs paid ${rupees(now.cpm)}.`,
          levers: [
            { label: "Pause the keyword", change: { kind: "pauseKeyword", term: k.term, paused: true } },
            { label: `Lower bid to ${rupees(now.maxProfitableCpm * 0.9)}`, change: { kind: "keywordBid", term: k.term, bid: Math.max(200, Math.round(now.maxProfitableCpm * 0.9)) } },
          ],
        });
      }
    }

    // Budget running out before the category's peak slot, two days running
    const peak = peakSlotOf(ctx);
    const peakDays = lastN(results, day, 2).map((r) => sumMetrics(cellsOf(r, cfg.id).filter((c) => c.slot === peak)));
    if (peakDays.length === 2 && peakDays.every((m) => m.searches > 0 && m.lostToBudget / m.searches > 0.25)) {
      found.push({
        type: "budgetCapPeak", day, campaignId: cfg.id, subject: String(peak),
        title: "Budget runs out before peak hours",
        evidence: `IS lost to budget in the peak slot was ${pct(peakDays[0].lostToBudget / peakDays[0].searches)} and ${pct(peakDays[1].lostToBudget / peakDays[1].searches)} on the last two days.`,
        levers: [
          { label: "Switch off 12–6 AM", change: { kind: "schedule", schedule: [2, 3, 4, 5, 6, 7] } },
          { label: "Raise the budget 30%", change: { kind: "budget", budget: Math.round(cfg.budget * 1.3) } },
        ],
      });
    }

    if (!capped) continue;
    // A head keyword taking the money from better keywords
    const units = byUnit(recentCells.filter((c) => c.inventory === "keyword"));
    const heavy = units.find((u) => campaign.spend > 0 && u.spend / campaign.spend > 0.6 && u.roas < campaign.roas);
    const better = units.find((u) => u.roas >= campaign.roas * 1.3 && u.key !== heavy?.key);
    if (heavy && better) {
      found.push({
        type: "headTakesMoney", day, campaignId: cfg.id, subject: heavy.key,
        title: `"${heavy.key}" is taking the budget`,
        evidence: `It took ${pct(heavy.spend / campaign.spend)} of spend at ROAS ${heavy.roas.toFixed(2)} while "${better.key}" made ${better.roas.toFixed(2)}.`,
        levers: [
          { label: `Lower "${heavy.key}" bid 20%`, change: { kind: "keywordBid", term: heavy.key, bid: Math.round((cfg.keywords.find((k) => k.term === heavy.key)?.exactBid ?? 300) * 0.8) } },
          { label: `Pause "${heavy.key}"`, change: { kind: "pauseKeyword", term: heavy.key, paused: true } },
        ],
      });
    }
    // A low-margin SKU losing money while the hero earns well
    const skus = bySku(recentCells);
    const loser = skus.find((s) => campaign.spend > 0 && s.spend / campaign.spend > 0.4 && s.roas < s.breakEvenRoas);
    const hero = skus.find((s) => s.roas >= s.breakEvenRoas * 1.3 && s.key !== loser?.key);
    if (loser && hero) {
      const loserTerms = units.filter((u) => recentCells.some((c) => c.term === u.key && c.skuId === loser.key)).map((u) => u.key);
      found.push({
        type: "heroStarved", day, campaignId: cfg.id, subject: loser.key,
        title: "A low-margin product is eating the budget",
        evidence: `${loser.key} took ${pct(loser.spend / campaign.spend)} of spend at ROAS ${loser.roas.toFixed(2)} (break-even ${loser.breakEvenRoas.toFixed(2)}); ${hero.key} made ${hero.roas.toFixed(2)}.`,
        levers: loserTerms.slice(0, 2).map((t) => ({ label: `Pause "${t}"`, change: { kind: "pauseKeyword" as const, term: t, paused: true } })),
      });
    }
    // A strong state rationed by a shared budget
    const states = byState(recentCells);
    const strong = states.find((s) => s.roas >= campaign.roas * 1.3 && s.spend > 0);
    if (strong && states.length > 1) {
      const keep = states.filter((s) => s.roas >= campaign.roas).map((s) => s.key);
      found.push({
        type: "stateStarved", day, campaignId: cfg.id, subject: strong.key,
        title: `${strong.key} is starved by the shared budget`,
        evidence: `ROAS in ${strong.key} was ${strong.roas.toFixed(2)} vs ${campaign.roas.toFixed(2)} for the campaign, which lost ${pct(campaign.lostToBudget / campaign.searches)} of searches to budget.`,
        levers: [
          { label: `Run only the stronger states (${keep.join(", ")})`, change: { kind: "states", geography: "select_cities", cities: keep } },
          { label: "Raise the budget 30%", change: { kind: "budget", budget: Math.round(cfg.budget * 1.3) } },
        ],
      });
    }
  }
  return found.filter((m) => m.levers.length > 0);
}

/** Moments in a run: each type × campaign × subject counts once (its first day), at most MAX_MOMENTS, earliest first. */
export function detectMoments(input: DetectInput): Moment[] {
  const moments: Moment[] = [];
  const seen = new Set<string>();
  for (const r of input.results) {
    if (r.day > input.ctx.totalDays - WINDOW) break;
    for (const m of detectForDay(input, r.day)) {
      const key = `${m.type}|${m.campaignId}|${m.subject}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moments.push({ ...m, id: `${key}|${r.day}`, window: WINDOW });
    }
  }
  return moments.slice(0, MAX_MOMENTS);
}

// ── Counterfactual scoring ────────────────────────────────────────────────────

export type GoalObjective = (m: Metrics) => number;

/** Objective by goal type (F13). */
export function objectiveFor(goalType: string): GoalObjective {
  switch (goalType) {
    case "Volume-First":
      return (m) => m.units + Math.min(0, m.profit) / Math.max(1, m.units > 0 ? m.contribution / m.units : 100);
    case "Awareness-First":
      return (m) => m.viewableImpressions * Math.min(1, m.breakEvenRoas > 0 ? m.roas / (0.7 * m.breakEvenRoas) : 0);
    case "Category-Creation":
      return (m) => (m.viewableImpressions * 0.5 + m.units * 200) * Math.min(1, m.breakEvenRoas > 0 ? m.roas / (0.6 * m.breakEvenRoas) : 0);
    default:
      return (m) => m.profit;
  }
}

export interface ReplayInput {
  ctx: MarketContext;
  launched: readonly CampaignConfig[];
  actions: readonly LiveAction[];
  /** statesByDay[d] = state after day d (index 0 = before day 1). */
  statesByDay: readonly MarketState[];
  /** Market events and Rohit effects of the real run, replayed unchanged. */
  stepOptions?: StepOptions;
}

function replay(input: ReplayInput, actions: readonly LiveAction[], fromDay: number, toDay: number): Metrics {
  let state = input.statesByDay[fromDay - 1];
  const cells = [];
  for (let d = fromDay; d <= toDay; d++) {
    const out = stepDay(input.ctx, state, applyActions(input.launched, actions, d), input.stepOptions);
    state = out.state;
    cells.push(...out.result.cells);
  }
  return sumMetrics(cells);
}

export interface MomentScore {
  moment: Moment;
  points: number;
  max: number;
  /** What the student did in the window, if anything. */
  studentAction: string | null;
  bestLever: string;
  gainVsNothing: number;
  bestGainVsNothing: number;
  verdict: "right" | "partial" | "wrong" | "ignored" | "nothingNeeded";
}

const TOLERANCE_SHARE = 0.02;

export function scoreMoment(input: ReplayInput, moment: Moment, maxPoints: number, describe: (a: LiveAction) => string): MomentScore {
  const from = moment.day + 1;
  const to = Math.min(input.ctx.totalDays, moment.day + moment.window + HORIZON_EXTRA);
  const inWindow = (a: LiveAction) => a.campaignId === moment.campaignId && a.dayMade >= moment.day && a.dayMade < moment.day + moment.window;
  const studentActions = input.actions.filter(inWindow);
  const withoutWindow = input.actions.filter((a) => !inWindow(a));
  const objective = objectiveFor(input.ctx.scenario.profile.goalType);

  const none = objective(replay(input, withoutWindow, from, to));
  const student = studentActions.length ? objective(replay(input, input.actions, from, to)) : none;
  const leverResults = moment.levers.map((l) => ({
    label: l.label,
    value: objective(replay(input, [...withoutWindow, { campaignId: moment.campaignId, dayMade: moment.day, change: l.change }], from, to)),
  }));
  const best = leverResults.reduce((a, b) => (b.value > a.value ? b : a), { label: "Do nothing", value: none });
  const bestValue = Math.max(best.value, student);
  const tolerance = Math.abs(none) * TOLERANCE_SHARE + 1;
  const bestGain = bestValue - none;
  const gain = student - none;

  let points: number;
  let verdict: MomentScore["verdict"];
  if (bestGain <= tolerance) {
    // Doing nothing was (about) best: full points unless the student made it worse
    points = gain >= -tolerance ? maxPoints : 0;
    verdict = gain >= -tolerance ? "nothingNeeded" : "wrong";
  } else if (studentActions.length === 0) {
    points = 0;
    verdict = "ignored";
  } else if (gain < -tolerance) {
    points = 0;
    verdict = "wrong";
  } else {
    const share = Math.max(0, Math.min(1, gain / bestGain));
    points = share >= 0.6 ? maxPoints : Math.round(maxPoints * share * 10) / 10;
    verdict = share >= 0.6 ? "right" : "partial";
  }
  return {
    moment, points, max: maxPoints,
    studentAction: studentActions.length ? studentActions.map(describe).join("; ") : null,
    bestLever: best.label, gainVsNothing: gain, bestGainVsNothing: bestGain, verdict,
  };
}
