// ── Calibration: does each brand's market teach what the spec says? ───────────
// Run with `npm run calibrate` (slow: ~10 thirty-day runs per brand).
// Targets: SPEC §3.3.4, §3.3.5, §3.7, §3.11, §4.1, §12.1 slice 1g.

import { describe, it, expect } from "vitest";
import { runHeadless, type HeadlessRun } from "@/market/headless";
import * as S from "@/market/calibration/strategies";
import { suggestKeywordRange } from "@/market/suggest";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "@/market/__tests__/testContext";

const PROFIT_GAIN = 1.15;
const PEAK_LOSS = 0.8;
const ROAS_BAND: [number, number] = [0.9, 1.5];
const BUDGET_USED = 0.95;
const PEAK_ONLY_MAX_SPEND = 0.85;
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

    it("naive play sits around break-even (ROAS 0.9–1.5× break-even)", () => {
      const ratio = naive.totals.roas / naive.totals.breakEvenRoas;
      expect(ratio).toBeGreaterThanOrEqual(ROAS_BAND[0]);
      expect(ratio).toBeLessThanOrEqual(ROAS_BAND[1]);
    });

    it("the ₹2,00,000 budget is tight: naive play spends at least 95% of it", () => {
      expect(naive.totals.spend / ctx.scenario.budget).toBeGreaterThanOrEqual(BUDGET_USED);
    });

    it("the central trap exists: some keyword's suggested range is above its max profitable CPM", () => {
      const traps = m.keywords.filter((k) => suggestKeywordRange(ctx, k.term).lo > S.keywordMaxCPM(ctx, k));
      report.push(`  trap keywords: ${traps.map((k) => k.term).join(", ")}`);
      expect(traps.length).toBeGreaterThan(0);
    });

    it("dayparting matters: the best schedule beats 24/7 by ≥ 15% profit, and dropping its peak costs ≥ 20%", () => {
      const results = Object.entries(S.CANDIDATE_SCHEDULES).map(([name, sched]) => ({ name, sched, profit: profit(S.onSchedule(ctx, sched)) }));
      const best = results.reduce((a, b) => (b.profit > a.profit ? b : a));
      const peak = S.peakSlots(ctx);
      const withoutPeak = best.sched.filter((s) => !peak.includes(s));
      const lostPeak = withoutPeak.length > 0 ? profit(S.onSchedule(ctx, withoutPeak)) : 0;
      report.push(`  best schedule "${best.name}" ₹${Math.round(best.profit)} (24/7 ₹${Math.round(naive.totals.profit)}); without peak ₹${Math.round(lostPeak)}`);
      expect(best.profit).toBeGreaterThanOrEqual(naive.totals.profit * PROFIT_GAIN);
      expect(lostPeak).toBeLessThanOrEqual(best.profit * PEAK_LOSS);
    });

    it("peak-only is too narrow to spend the budget", () => {
      const spend = runHeadless(ctx, S.onSchedule(ctx, S.peakSlots(ctx))).totals.spend;
      expect(spend / ctx.scenario.budget).toBeLessThanOrEqual(PEAK_ONLY_MAX_SPEND);
    });

    if (m.traps.includes("headLong")) {
      it("splitting head and long-tail keywords beats one campaign by ≥ 15% profit", () => {
        const split = profit(S.headLongSplit(ctx));
        report.push(`  head/long split ₹${Math.round(split)}`);
        expect(split).toBeGreaterThanOrEqual(naive.totals.profit * PROFIT_GAIN);
      });
    }

    if (m.traps.includes("hero")) {
      it("putting the budget behind the hero SKU beats spreading it by ≥ 15% profit", () => {
        const hero = profit(S.heroWeighted(ctx));
        report.push(`  hero (${S.heroSku(ctx)}) ₹${Math.round(hero)}`);
        expect(hero).toBeGreaterThanOrEqual(naive.totals.profit * PROFIT_GAIN);
      });
    }

    if (m.traps.includes("stateSplit")) {
      it("a funded campaign for the best-converting state beats one Pan India campaign by ≥ 15% profit", () => {
        const split = profit(S.stateSplit(ctx, 0.5));
        report.push(`  state split ₹${Math.round(split)}`);
        expect(split).toBeGreaterThanOrEqual(naive.totals.profit * PROFIT_GAIN);
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

    it("prints the calibration report", () => {
      console.log(report.join("\n"));
    });
  });
}
