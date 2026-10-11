// ── Calibration: does each brand's market teach what the spec says? ───────────
// Run with `npm run calibrate` (slow: ~10 thirty-day runs per brand).
// Targets: SPEC §3.3.4, §3.3.5, §3.7, §3.11, §4.1, §12.1 slice 1g.

import { describe, it, expect } from "vitest";
import { runHeadless, type HeadlessRun } from "@/market/headless";
import { objectiveFor } from "@/market/moments";
import { sumMetrics } from "@/market/aggregate";
import * as S from "@/market/calibration/strategies";
import { suggestKeywordRange } from "@/market/suggest";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "@/market/__tests__/testContext";

/** A lesson "works" if the right move improves profit by ≥ 15% of the baseline's size and ≥ ₹10,000
 *  (a ₹ difference, so it stays meaningful when the baseline is a loss). */
const GAIN_SHARE = 0.15;
const MIN_GAIN = 10000;
const DAYPARTING_GOALS = new Set(["ROAS-First", "Volume-First"]);
const improves = (better: number, baseline: number, share = GAIN_SHARE) =>
  better - baseline >= Math.max(share * Math.abs(baseline), MIN_GAIN);
const ROAS_BAND: [number, number] = [0.9, 1.5];
const ROAS_BANDS: Partial<Record<string, [number, number]>> = {
  "ROAS-First": [0.9, 1.5],
  "thin-margin": [0.6, 1.2],
  "Volume-First": [0.8, 1.4],
  "Awareness-First": [0.5, 1.15],
  "Category-Creation": [0.4, 1.0],
};
const BUDGET_USED = 0.95;
/** SPEC §13 #33: a competent default (good keywords + category pages, mid-range bids) for a
 *  sales-led brand sits around break-even (decision #12), never far above it, and the budget stays tight. */
const COMPETENT_BAND: [number, number] = [0.9, 2.0];
const COMPETENT_BUDGET_USED = 0.6;
const SALES_GOALS = new Set(["ROAS-First", "Volume-First"]);
/** The F13 ROAS gates: below these the brand's own goal scores nothing. */
const REACH_FLOOR: Partial<Record<string, number>> = { "Awareness-First": 0.7, "Category-Creation": 0.6 };
const OSA_FLOOR_BEFORE_RESTOCK = 0.2;
const CHALLENGER_BURNOUT: [number, number] = [12, 28];
const RUN_MS_LIMIT = 1500;

function challengerBurnoutDay(run: HeadlessRun, rivalId: string, budget: number): number | null {
  let spent = 0;
  for (const r of run.results) {
    spent += r.rivals.filter((x) => x.rivalId === rivalId).reduce((s, x) => s + x.spend, 0);
    if (spent >= budget) return r.day;
  }
  return null;
}

for (const brandId of Object.keys(MARKET_DATA)) {
  describe(`calibration: ${brandId}`, () => {
    const ctx = testContext(brandId);
    const m = ctx.market;
    const t0 = performance.now();
    const naive = runHeadless(ctx, S.naive(ctx));
    const naiveMs = performance.now() - t0;
    const profit = (strategy: S.Strategy) => runHeadless(ctx, strategy).totals.profit;
    const report: string[] = [`${brandId}: naive ROAS ${naive.totals.roas.toFixed(2)} vs break-even ${naive.totals.breakEvenRoas.toFixed(2)}, profit ₹${Math.round(naive.totals.profit)}`];

    it(`runs 30 days in under ${RUN_MS_LIMIT} ms`, () => {
      expect(naiveMs).toBeLessThan(RUN_MS_LIMIT);
    });

    // ROAS-first brands: naive search play near break-even. Awareness and category-creation
    // brands: search alone runs below break-even (their lesson is that search can't carry them).
    // Henlo's lesson is its thin margin, so naive play may lose money there
    const band = (brandId === "henlo" ? ROAS_BANDS["thin-margin"] : ROAS_BANDS[ctx.scenario.profile.goalType]) ?? ROAS_BAND;
    it(`naive play sits at ${band[0]}–${band[1]}× break-even for a ${ctx.scenario.profile.goalType} brand`, () => {
      const ratio = naive.totals.roas / naive.totals.breakEvenRoas;
      expect(ratio).toBeGreaterThanOrEqual(band[0]);
      expect(ratio).toBeLessThanOrEqual(band[1]);
    });

    it("the ₹2,00,000 budget is tight: naive play spends at least 95% of it", () => {
      expect(naive.totals.spend / ctx.scenario.budget).toBeGreaterThanOrEqual(BUDGET_USED);
    });

    it("the central trap exists: some keyword's suggested range is above its max profitable CPM", () => {
      const traps = m.keywords.filter((k) => suggestKeywordRange(ctx, k.term).lo > S.keywordMaxCPM(ctx, k));
      report.push(`  trap keywords: ${traps.map((k) => k.term).join(", ")}`);
      expect(traps.length).toBeGreaterThan(0);
    });

    it("dayparting matters on the brand's own goal: the best schedule beats 24/7 (≥ 15%) and is built around the category's peak", () => {
      // Judge by the brand's goal (profit, units or reach), as scoring does (§14 F13): for
      // loss-making awareness brands, "best by profit" would just pick the schedule that spends least.
      const goal = objectiveFor(ctx.scenario.profile.goalType);
      const value = (strategy: S.Strategy) => goal(sumMetrics(runHeadless(ctx, strategy).results.flatMap((r) => r.cells)));
      const baseline = goal(sumMetrics(naive.results.flatMap((r) => r.cells)));
      const results = Object.entries(S.CANDIDATE_SCHEDULES).map(([name, sched]) => ({ name, sched, value: value(S.onSchedule(ctx, sched)) }));
      const best = results.reduce((a, b) => (b.value > a.value ? b : a));
      const peak = S.peakSlots(ctx);
      report.push(`  best schedule on the brand's goal: "${best.name}" ${Math.round(best.value)} vs 24/7 ${Math.round(baseline)}`);
      // Dayparting is a money and volume lesson (SPEC §3.3); for reach goals a view counts at any
      // hour, so there we only require that the best schedule keeps the brand's peak hours.
      if (DAYPARTING_GOALS.has(ctx.scenario.profile.goalType)) {
        expect(best.value - baseline).toBeGreaterThanOrEqual(Math.abs(baseline) * GAIN_SHARE);
      }
      expect(peak.every((p) => best.sched.includes(p))).toBe(true);
    });

    if (m.traps.includes("headLong")) {
      it("splitting head and long-tail keywords beats one campaign by ≥ 15% profit", () => {
        const split = profit(S.headLongSplit(ctx));
        report.push(`  head/long split ₹${Math.round(split)}`);
        expect(improves(split, naive.totals.profit)).toBe(true);
      });
    }

    if (m.traps.includes("hero")) {
      it("putting the budget behind the hero SKU beats spreading it by ≥ 15% profit", () => {
        const hero = profit(S.heroWeighted(ctx));
        report.push(`  hero (${S.heroSku(ctx)}) ₹${Math.round(hero)}`);
        expect(improves(hero, naive.totals.profit)).toBe(true);
      });
    }

    if (m.traps.includes("stateSplit")) {
      it("a funded campaign for the best-converting state beats one Pan India campaign by ≥ 15% profit", () => {
        const split = profit(S.stateSplit(ctx, 0.5));
        report.push(`  state split ₹${Math.round(split)}`);
        expect(improves(split, naive.totals.profit)).toBe(true);
      });
    }

    for (const r of m.rivals.filter((x) => x.archetype === "challenger")) {
      it(`challenger ${r.name} burns its budget around day ${CHALLENGER_BURNOUT.join("–")}`, () => {
        const day = challengerBurnoutDay(naive, r.id, r.monthlyBudget);
        report.push(`  ${r.name} out of budget on day ${day ?? "never"}`);
        expect(day).not.toBeNull();
        expect(day!).toBeGreaterThanOrEqual(CHALLENGER_BURNOUT[0]);
        expect(day!).toBeLessThanOrEqual(CHALLENGER_BURNOUT[1]);
      });
    }

    if (m.traps.includes("creative")) {
      it("a clean creative beats a weak one on Spotlight by ≥ 20% revenue", () => {
        const revenue = (creativeMult: number) => runHeadless(ctx, S.spotlightCampaign(ctx, creativeMult)).totals.revenue;
        const good = revenue(1.1), weak = revenue(0.8);
        report.push(`  Spotlight revenue: clean ₹${Math.round(good)} vs weak ₹${Math.round(weak)}`);
        expect(good).toBeGreaterThanOrEqual(weak * 1.2);
      });
    }

    it("healthy stock lasts to the first restock: no stocked state below 20% OSA before day 7 (§13 #32)", () => {
      const early = naive.results.filter((r) => r.day < 7).flatMap((r) => r.stock).filter((x) => x.opening > 0);
      expect(early.every((x) => x.osa >= OSA_FLOOR_BEFORE_RESTOCK)).toBe(true);
    });

    if (SALES_GOALS.has(ctx.scenario.profile.goalType)) {
      it(`a competent default sits at ${COMPETENT_BAND.join("–")}× break-even and spends ≥ 60% of the budget (§13 #33a)`, () => {
        const run = runHeadless(ctx, S.competent(ctx));
        const ratio = run.totals.roas / run.totals.breakEvenRoas;
        report.push(`  competent default ${ratio.toFixed(2)}× break-even, ${Math.round((run.totals.spend / ctx.scenario.budget) * 100)}% of budget`);
        expect(ratio).toBeGreaterThanOrEqual(COMPETENT_BAND[0]);
        expect(ratio).toBeLessThanOrEqual(COMPETENT_BAND[1]);
        expect(run.totals.spend / ctx.scenario.budget).toBeGreaterThanOrEqual(COMPETENT_BUDGET_USED);
      });
    }

    const floor = REACH_FLOOR[ctx.scenario.profile.goalType];
    const reach = S.awarenessDefault(ctx);
    if (floor !== undefined && reach) {
      it(`the recommended reach format at its default bid reaches ≥ ${floor}× break-even (§13 #33b)`, () => {
        const run = runHeadless(ctx, reach);
        const ratio = run.totals.roas / run.totals.breakEvenRoas;
        report.push(`  ${ctx.scenario.profile.optimalAdFormat} default ${ratio.toFixed(2)}× break-even`);
        expect(ratio).toBeGreaterThanOrEqual(floor);
      });
    }

    it("prints the calibration report", () => {
      console.log(report.join("\n"));
    });
  });
}
