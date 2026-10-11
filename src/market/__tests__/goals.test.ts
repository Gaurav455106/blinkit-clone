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

describe("goal targets follow the stock label (what good play can reach)", () => {
  const withTone = (id: string, tone: "healthy" | "warning" | "critical") => {
    const s = testContext(id).scenario;
    return clientGoalsV2({ ...s, inventory: { ...s.inventory, tone } });
  };
  const target = (g: ReturnType<typeof clientGoalsV2>, label: string) => g.metrics.find((m) => m.label === label)?.target ?? 0;

  it("critical stock lowers units and views targets; ROAS and CTR stay", () => {
    const healthy = withTone("glow", "healthy"), critical = withTone("glow", "critical");
    expect(target(critical, "Impressions") / target(healthy, "Impressions")).toBeCloseTo(0.4, 1);
    expect(target(critical, "Units sold") / target(healthy, "Units sold")).toBeCloseTo(0.3, 1);
    expect(target(critical, "CTR")).toBe(target(healthy, "CTR"));
    const fuelHealthy = withTone("fuelup", "healthy"), fuelCritical = withTone("fuelup", "critical");
    expect(target(fuelCritical, "ROAS")).toBe(target(fuelHealthy, "ROAS"));
  });

  it("shaky stock trims them a little", () => {
    expect(target(withTone("henlo", "warning"), "Units sold") / target(withTone("henlo", "healthy"), "Units sold")).toBeCloseTo(0.9, 1);
  });
});
