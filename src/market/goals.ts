// ── Client goals for v2, calibrated to the engine (Gaurav: calibrate to the brief) ──
// Targets come from what good play actually achieves in each brand's market
// (benchmarks below, from `npm run calibrate`: best runs that spend at least 90%
// of the budget). Targets sit a little below good play, so a good student can
// hit them and naive play usually can't. Only goals the v2 engine measures.

import type { ClientGoals, GoalMetric, Scenario } from "@/data/scenarios";

export interface GoalBenchmark {
  /** Break-even ROAS of the brand's sales mix. */
  breakEven: number;
  units: number;
  views: number;
  ctrPct: number;
}

/** Re-checked by src/market/calibration/benchmarks.calibration.ts (fails if the engine drifts > 10%). */
export const GOAL_BENCHMARKS: Readonly<Record<string, GoalBenchmark>> = {
  henlo:     { breakEven: 7.11, units: 4697, views: 513913, ctrPct: 6.84 },
  glow:      { breakEven: 4.48, units: 866,  views: 413994, ctrPct: 2.56 },
  vitaboost: { breakEven: 4.01, units: 627,  views: 658705, ctrPct: 1.33 },
  tinybuddy: { breakEven: 3.72, units: 3246, views: 500473, ctrPct: 4.23 },
  munchbox:  { breakEven: 3.85, units: 8789, views: 638650, ctrPct: 7.86 },
  pawlife:   { breakEven: 3.36, units: 825,  views: 507853, ctrPct: 2.88 },
  fuelup:    { breakEven: 3.3,  units: 940,  views: 530762, ctrPct: 2.18 },
};

const STRETCH = 0.85;
const LIGHT = 0.7;
/** Share of the healthy-stock units and views that good play can still reach, by stock label.
 *  Measured with the benchmark strategies on all 7 brands (2026-10-12): shaky ~0.92 / 0.92,
 *  critical ~0.31 / 0.39. Rates (ROAS, CTR) don't depend on stock, so they aren't scaled. */
const STOCK_REACH: Readonly<Partial<Record<string, { units: number; views: number }>>> = {
  healthy: { units: 1, views: 1 },
  warning: { units: 0.9, views: 0.9 },
  critical: { units: 0.3, views: 0.4 },
};

/** Unique people reached ≈ 60% of views. */
const REACH_PER_VIEW = 0.6;

import { formatHint } from "@/market/formats";

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
const round1 = (n: number) => Math.round(n * 10) / 10;

function goals(primary: string, lifecycle: ClientGoals["lifecycle"], performanceGoals: GoalMetric[], reachGoals: GoalMetric[], campaignHint: string): ClientGoals {
  return {
    primary, lifecycle, performanceGoals, reachGoals,
    metrics: [...performanceGoals, ...reachGoals],
    threshold: "Hit 90% or more of these goals to be promoted to Senior Executive.",
    campaignHint,
  };
}

/** The client's goals for a v2 run of this scenario. Falls back to the v1 goals for unknown brands. */
export function clientGoalsV2(scenario: Scenario): ClientGoals {
  const b = GOAL_BENCHMARKS[scenario.profile.id];
  if (!b) return scenario.clientGoals;
  const stock = STOCK_REACH[scenario.inventory.tone] ?? { units: 1, views: 1 };
  const units = roundTo(b.units * STRETCH * stock.units, 10);
  const reach = roundTo(b.views * REACH_PER_VIEW * STRETCH * stock.views, 1000);
  const impressions = roundTo(b.views * STRETCH * stock.views, 1000);
  const lightUnits = roundTo(b.units * LIGHT * stock.units, 10);

  if (scenario.inventory.tone === "overstocked") {
    return goals("Sell the extra stock before it goes old", "Retain",
      [{ label: "Units sold", target: roundTo(b.units * 1.1, 10), unit: "units" }, { label: "Minimum ROAS", target: round1(b.breakEven * 0.8), unit: "x" }],
      [],
      formatHint(scenario));
  }
  switch (scenario.profile.goalType) {
    case "ROAS-First":
      return goals("Make sales that earn back more than the ads cost", "Convert",
        [{ label: "ROAS", target: round1(b.breakEven * 1.15), unit: "x" }, { label: "Units sold", target: units, unit: "units" }],
        [{ label: "Reach", target: reach, unit: "people" }],
        formatHint(scenario));
    case "Volume-First":
      return goals("Sell as many units as possible without losing money", "Convert",
        [{ label: "Units sold", target: units, unit: "units" }, { label: "Minimum ROAS", target: round1(b.breakEven * 0.95), unit: "x" }],
        [{ label: "Reach", target: reach, unit: "people" }],
        formatHint(scenario));
    case "Awareness-First":
      return goals("Get the brand seen by lots of new shoppers", "Acquire",
        [{ label: "CTR", target: round1(b.ctrPct * 0.9), unit: "%" }, { label: "Units sold", target: lightUnits, unit: "units" }],
        [{ label: "Impressions", target: impressions, unit: "views" }],
        formatHint(scenario));
    case "Category-Creation":
      return goals("Teach shoppers that this kind of product exists", "Acquire",
        [{ label: "Units sold", target: lightUnits, unit: "units" }],
        [{ label: "Reach", target: reach, unit: "people" }, { label: "Impressions", target: impressions, unit: "views" }],
        formatHint(scenario));
    default:
      return scenario.clientGoals;
  }
}
