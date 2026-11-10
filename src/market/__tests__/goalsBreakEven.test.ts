// FIXES-TODO #3: the client's ROAS target must not ask for a loss unless the
// brief says so, and the deal sheet must show how a discount moves break-even.

import { describe, expect, it } from "vitest";
import { clientGoalsV2, GOAL_BENCHMARKS, roasGoalConflict } from "@/market/goals";
import { skuBreakEven } from "@/market/deal";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "./testContext";

const TONES = ["healthy", "warning", "critical", "overstocked"] as const;
const roasTargets = (g: ReturnType<typeof clientGoalsV2>) => g.metrics.filter((m) => /ROAS/.test(m.label)).map((m) => m.target);

describe("ROAS targets and break-even", () => {
  for (const id of Object.keys(MARKET_DATA)) {
    for (const tone of TONES) {
      it(`${id} (${tone}): never asks for less than break-even unless the brief says a loss is fine`, () => {
        const s = testContext(id).scenario;
        const g = clientGoalsV2({ ...s, inventory: { ...s.inventory, tone } });
        const allowsLoss = /small loss/i.test(`${g.primary} ${g.campaignHint}`);
        for (const target of roasTargets(g)) {
          if (!allowsLoss) expect(target).toBeGreaterThanOrEqual(GOAL_BENCHMARKS[id].breakEven);
        }
      });
    }
  }

  it("an overstocked brief says outright that a small loss on ads is fine", () => {
    const s = testContext("tinybuddy").scenario;
    const g = clientGoalsV2({ ...s, inventory: { ...s.inventory, tone: "overstocked" } });
    expect(g.primary).toMatch(/small loss/i);
  });
});

describe("skuBreakEven", () => {
  it("is price over what you keep, and a discount raises it", () => {
    // TinyBuddy wipes: ₹199, keep ₹50 → 4.0; 10% off → ₹179, keep ₹30 → 6.0
    expect(skuBreakEven(199, 50, 0)).toEqual({ price: 199, kept: 50, roas: 3.98 });
    const after = skuBreakEven(199, 50, 0.1);
    expect(after.price).toBe(179);
    expect(after.kept).toBe(30);
    expect(after.roas).toBeCloseTo(5.97, 2);
  });

  it("has no break-even when the discount eats the whole margin", () => {
    expect(skuBreakEven(100, 10, 0.2).roas).toBe(Infinity);
  });
});

describe("roasGoalConflict", () => {
  const goals = (target: number) => ({ metrics: [{ label: "Minimum ROAS", target, unit: "x" }] });

  it("flags a ROAS goal below the run's real break-even", () => {
    expect(roasGoalConflict(goals(3.8), 5.9)).toEqual({ label: "Minimum ROAS", target: 3.8, breakEven: 5.9 });
  });

  it("stays quiet when the goal covers break-even, or nothing has sold yet", () => {
    expect(roasGoalConflict(goals(4), 3.9)).toBeNull();
    expect(roasGoalConflict(goals(4), 0)).toBeNull();
    expect(roasGoalConflict({ metrics: [{ label: "Units sold", target: 900, unit: "units" }] }, 5)).toBeNull();
  });
});
