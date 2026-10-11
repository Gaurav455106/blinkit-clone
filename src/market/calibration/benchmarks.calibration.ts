// Prints the good-play benchmarks used for v2 client goal targets (src/market/goals.ts).
import { it } from "vitest";
import { runHeadless } from "@/market/headless";
import * as S from "@/market/calibration/strategies";
import { objectiveFor } from "@/market/moments";
import { sumMetrics } from "@/market/aggregate";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "@/market/__tests__/testContext";
import { GOAL_BENCHMARKS } from "@/market/goals";
import { expect } from "vitest";

it("goal benchmarks still match the engine", () => {
  const out: Record<string, unknown> = {};
  for (const brand of Object.keys(MARKET_DATA)) {
    const ctx = testContext(brand);
    const goal = objectiveFor(ctx.scenario.profile.goalType);
    const strategies = [S.naive(ctx), S.heroWeighted(ctx), S.headLongSplit(ctx), S.stateSplit(ctx, 0.5), S.spotlightCampaign(ctx, 1), ...Object.values(S.CANDIDATE_SCHEDULES).map((s) => S.onSchedule(ctx, s))];
    const runs = strategies.map((s) => sumMetrics(runHeadless(ctx, s).results.flatMap((r) => r.cells)));
    // Only runs that use the budget: goals assume the student spends it
    const spending = runs.filter((r) => r.spend >= 0.9 * ctx.scenario.budget);
    const pool = spending.length ? spending : runs;
    const best = pool.reduce((a, b) => (goal(b) > goal(a) ? b : a));
    const naive = runs[0];
    out[brand] = { breakEven: +naive.breakEvenRoas.toFixed(2), units: Math.round(Math.max(...pool.map((r) => r.units))), views: Math.round(Math.max(...pool.map((r) => r.viewableImpressions))), ctrPct: +(best.ctr * 100).toFixed(2), naiveUnits: Math.round(naive.units) };
  }
  console.log("BENCH " + JSON.stringify(out));
  // Goal targets must still match what the engine produces (update goals.ts if this fails)
  const DRIFT = 0.1;
  for (const [brand, b] of Object.entries(out) as [string, { units: number; views: number }][]) {
    expect(Math.abs(b.units - GOAL_BENCHMARKS[brand].units) / GOAL_BENCHMARKS[brand].units).toBeLessThanOrEqual(DRIFT);
    expect(Math.abs(b.views - GOAL_BENCHMARKS[brand].views) / GOAL_BENCHMARKS[brand].views).toBeLessThanOrEqual(DRIFT);
  }
}, 600000);
