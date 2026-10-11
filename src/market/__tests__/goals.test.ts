import { describe, it, expect } from "vitest";
import { clientGoalsV2, GOAL_BENCHMARKS } from "@/market/goals";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "./testContext";

describe("v2 client goals (calibrated to the engine)", () => {
  it("has a benchmark for every brand", () => {
    expect(Object.keys(GOAL_BENCHMARKS).sort()).toEqual(Object.keys(MARKET_DATA).sort());
  });

  it("ROAS-first targets are 1.15× break-even, so hitting them means making money", () => {
    const g = clientGoalsV2(testContext("fuelup").scenario);
    expect(g.metrics.find((m) => m.label === "ROAS")?.target).toBeCloseTo(3.8, 6);
    expect(g.metrics.find((m) => m.label === "Units sold")?.target).toBe(800);
  });

  it("only uses goals the v2 engine can measure", () => {
    const measurable = new Set(["ROAS", "Minimum ROAS", "Units sold", "Impressions", "Reach", "CTR"]);
    for (const id of Object.keys(MARKET_DATA)) {
      for (const m of clientGoalsV2(testContext(id).scenario).metrics) expect(measurable.has(m.label)).toBe(true);
    }
  });

  it("uses plain words and no em dashes", () => {
    for (const id of Object.keys(MARKET_DATA)) {
      const g = clientGoalsV2(testContext(id).scenario);
      expect(`${g.primary} ${g.campaignHint} ${g.threshold}`).not.toMatch(/—/);
    }
  });
});
