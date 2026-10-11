import { describe, it, expect } from "vitest";
import { initialRivalState, updateRival, rivalBid, rivalPrice, type RivalDayStats } from "@/market/rivals";
import { FUELUP } from "@/market/data/fuelup";

const iron = FUELUP.rivals.find((r) => r.id === "ironwhey")!;      // target SOV 0.40, floor 2.6, lag 2
const whey = FUELUP.rivals.find((r) => r.id === "wheynation")!;    // burst days 9–15 ×1.47
const profit = FUELUP.rivals.find((r) => r.id === "profit-basics")!; // price cut day 12, 15%

const stats = (sov: number, roas3d: number | null = 4, spend = 1000): RivalDayStats => ({ sov, roas3d, spend });

describe("updateRival (F11)", () => {
  it("raises bids only after `lag` days of low SOV, then +15% per day", () => {
    let s = initialRivalState(iron);
    s = updateRival(iron, s, stats(0.2));
    expect(s.bidMult).toBe(1);                // day 1 low: still waiting
    s = updateRival(iron, s, stats(0.2));
    expect(s.bidMult).toBeCloseTo(1.15, 6);   // day 2 low: reacts
    s = updateRival(iron, s, stats(0.2));
    expect(s.bidMult).toBeCloseTo(1.15 ** 2, 6);
  });

  it("never goes above its max bid", () => {
    let s = initialRivalState(iron);
    for (let i = 0; i < 20; i++) s = updateRival(iron, s, stats(0.1));
    expect(s.bidMult).toBeCloseTo(iron.maxBidMult, 6);
  });

  it("cuts bids ×0.9 when ROAS is below its floor, even if SOV is low (profit beats share)", () => {
    let s = initialRivalState(iron);
    s = updateRival(iron, s, stats(0.1, iron.roasFloor - 0.1));
    expect(s.bidMult).toBeCloseTo(0.9, 6);
  });

  it("drifts down ×0.95 when SOV is well above target", () => {
    const s = updateRival(iron, initialRivalState(iron), stats(iron.targetSov + 0.2));
    expect(s.bidMult).toBeCloseTo(0.95, 6);
  });

  it("holds steady near its target and resets the low-SOV streak", () => {
    let s = updateRival(iron, initialRivalState(iron), stats(0.2));
    s = updateRival(iron, s, stats(iron.targetSov));
    expect(s.bidMult).toBe(1);
    expect(s.lowSovStreak).toBe(0);
  });

  it("adds up what it spends", () => {
    let s = initialRivalState(iron);
    s = updateRival(iron, s, stats(0.4, 4, 1200));
    s = updateRival(iron, s, stats(0.4, 4, 800));
    expect(s.spent).toBe(2000);
  });
});

describe("rivalBid", () => {
  it("is the starting bid × reaction × slot pressure", () => {
    const s = { ...initialRivalState(iron), bidMult: 1.1 };
    expect(rivalBid(iron, s, "whey protein", 5, 1.25)).toBeCloseTo(420 * 1.1 * 1.25, 6);
  });

  it("is null on keywords it doesn't bid on, and once its budget is spent", () => {
    const s = initialRivalState(iron);
    expect(rivalBid(iron, s, "protein bar", 5, 1)).toBeNull();
    expect(rivalBid(iron, { ...s, spent: iron.monthlyBudget }, "whey protein", 5, 1)).toBeNull();
  });

  it("applies a challenger's burst only inside its window", () => {
    const s = initialRivalState(whey);
    expect(rivalBid(whey, s, "whey protein", 8, 1)).toBeCloseTo(380, 6);
    expect(rivalBid(whey, s, "whey protein", 9, 1)).toBeCloseTo(380 * 1.47, 6);
    expect(rivalBid(whey, s, "whey protein", 16, 1)).toBeCloseTo(380, 6);
  });

  it("keeps a newcomer out until its launch day", () => {
    const newcomer = { ...iron, id: "new", activeFromDay: 10 };
    const s = initialRivalState(newcomer);
    expect(rivalBid(newcomer, s, "whey protein", 9, 1)).toBeNull();
    expect(rivalBid(newcomer, s, "whey protein", 10, 1)).not.toBeNull();
  });
});

describe("rivalPrice", () => {
  it("drops by the price cut from its day onward", () => {
    expect(rivalPrice(profit, 11)).toBe(899);
    expect(rivalPrice(profit, 12)).toBeCloseTo(899 * 0.85, 6);
  });
});
