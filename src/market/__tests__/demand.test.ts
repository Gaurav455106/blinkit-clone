import { describe, it, expect } from "vitest";
import { stateShares, expectedSearches, searches, DOW_MULT, EVENT_CAP, type DemandContext } from "@/market/demand";
import { FUELUP } from "@/market/data/fuelup";
import { SLOT_COUNT } from "@/market/types";

const kw = FUELUP.keywords.find((k) => k.term === "whey protein")!;
const base: DemandContext = { seed: "batch-1", day: 3, weekday: 3, seasonMult: 1, eventMults: [] };

describe("stateShares", () => {
  it("sums to 1 across all states and favours states with more dark stores", () => {
    const shares = stateShares(FUELUP);
    const total = Object.values(shares).reduce((s, x) => s + x, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(shares["Maharashtra"]).toBeGreaterThan(shares["Goa"]);
  });
});

describe("weekday multipliers", () => {
  it("average to 1 over a week", () => {
    expect(DOW_MULT.reduce((s, x) => s + x, 0) / 7).toBeCloseTo(1, 6);
  });
});

describe("expectedSearches (F1)", () => {
  it("adds up to the keyword's daily volume across states and slots on an average day", () => {
    const shares = stateShares(FUELUP);
    let total = 0;
    for (const state of Object.keys(shares)) {
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        total += expectedSearches(FUELUP, kw, state, slot, { ...base, weekday: null });
      }
    }
    expect(total).toBeCloseTo(kw.dailyVolume, 0);
  });

  it("caps combined event multipliers at 2×", () => {
    const plain = expectedSearches(FUELUP, kw, "Karnataka", 6, base);
    const stacked = expectedSearches(FUELUP, kw, "Karnataka", 6, { ...base, eventMults: [1.6, 1.3, 1.4, 1.5] });
    expect(stacked / plain).toBeCloseTo(EVENT_CAP, 6);
  });

  it("is highest in the category's peak slot", () => {
    const bySlot = Array.from({ length: SLOT_COUNT }, (_, s) => expectedSearches(FUELUP, kw, "Karnataka", s, base));
    expect(bySlot.indexOf(Math.max(...bySlot))).toBe(6);
  });
});

describe("searches", () => {
  it("is a whole number, repeatable for the same key, and different across days", () => {
    const a = searches(FUELUP, kw, "Karnataka", 6, base);
    expect(Number.isInteger(a)).toBe(true);
    expect(searches(FUELUP, kw, "Karnataka", 6, base)).toBe(a);
    const days = Array.from({ length: 10 }, (_, d) => searches(FUELUP, kw, "Karnataka", 6, { ...base, day: d + 1 }));
    expect(new Set(days).size).toBeGreaterThan(1);
  });
});
