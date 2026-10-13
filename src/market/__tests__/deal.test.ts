import { describe, it, expect } from "vitest";
import {
  stockPool, allowedStates, defaultDeal, walkAwayDeal, validateDeal, dealToRun, withStartStock,
  SHELF_BOOST, SHELF_DAYS, DISCOUNT_DAYS, FAST_RESTOCK_DAY, BUSY_STORES_REACH, type DealTerms,
} from "@/market/deal";
import type { DayResult } from "@/market/engineTypes";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import { testContext } from "@/market/__tests__/testContext";
import { campaign } from "@/market/__tests__/liveFixtures";

const fuel = testContext("fuelup");
const profile = fuel.scenario.profile;
const [primary, second] = [profile.primaryState, profile.secondaryStates[0]];
const total = (m: Readonly<Record<string, number>>) => Object.values(m).reduce((s, x) => s + x, 0);

/** Moves `units` of a SKU from one state to another in a deal's stock split. */
function move(d: DealTerms, sku: string, from: string, to: string, units: number): DealTerms {
  const row = d.stock[sku];
  return { ...d, stock: { ...d.stock, [sku]: { ...row, [from]: (row[from] ?? 0) - units, [to]: (row[to] ?? 0) + units } } };
}

describe("stock pool and default deal", () => {
  it("each SKU's pool is the brief's starting units across all states", () => {
    const start = initialMarketState(fuel).stock;
    for (const sku of profile.skus) expect(stockPool(fuel)[sku.id]).toBeCloseTo(total(start[sku.id]), 6);
  });

  it("the student can place stock in the primary and secondary states only", () => {
    expect(allowedStates(fuel)).toEqual([primary, ...profile.secondaryStates]);
  });

  it("the default deal reproduces the brief exactly, so walking away changes nothing", () => {
    const run = dealToRun(fuel, walkAwayDeal(fuel));
    expect(initialMarketState(withStartStock(fuel, run.startStock)).stock).toEqual(initialMarketState(fuel).stock);
    expect(run.adjustments).toEqual({ stockAdds: [], extraSpend: [], priceCuts: [], shelfBoosts: [], storeReach: [] });
    expect(run.commitments).toEqual([]);
    expect(walkAwayDeal(fuel).walkedAway).toBe(true);
    expect(defaultDeal(fuel).walkedAway).toBe(false);
  });
});

describe("validateDeal", () => {
  it("accepts the default and an under-allocated split (spare units stay in the warehouse)", () => {
    expect(validateDeal(fuel, defaultDeal(fuel))).toEqual([]);
    const d = defaultDeal(fuel);
    expect(validateDeal(fuel, { ...d, stock: { ...d.stock, "fuel-1": { ...d.stock["fuel-1"], [primary]: 0 } } })).toEqual([]);
  });

  it("rejects stock in a state Rohit can't serve, more than the pool, or below zero", () => {
    const d = defaultDeal(fuel);
    expect(validateDeal(fuel, { ...d, stock: { ...d.stock, "fuel-1": { ...d.stock["fuel-1"], Goa: 10 } } })[0]).toMatch(/Goa/);
    expect(validateDeal(fuel, { ...d, stock: { ...d.stock, "fuel-1": { ...d.stock["fuel-1"], [primary]: stockPool(fuel)["fuel-1"] + 50 } } })[0]).toMatch(/more than/);
    expect(validateDeal(fuel, { ...d, stock: { ...d.stock, "fuel-1": { ...d.stock["fuel-1"], [primary]: -5 } } })[0]).toMatch(/below zero/);
  });

  it("accepts whole units that add up to the pool as shown, even when the real pool rounds up", () => {
    const d = defaultDeal(fuel);
    const sku = profile.skus.map((x) => x.id).find((id) => stockPool(fuel)[id] % 1 >= 0.5)!;
    const shown = Math.round(stockPool(fuel)[sku]);
    const row = Object.fromEntries(allowedStates(fuel).map((st, i) => [st, i === 0 ? shown : 0]));
    expect(validateDeal(fuel, { ...d, stock: { ...d.stock, [sku]: row } })).toEqual([]);
    expect(validateDeal(fuel, { ...d, stock: { ...d.stock, [sku]: { ...row, [primary]: shown + 1 } } })[0]).toMatch(/more than/);
  });

  it("allows at most two asks and one of each give", () => {
    const d = defaultDeal(fuel);
    const three = { ...d, asks: [{ kind: "shelfSpot" as const }, { kind: "moreStores" as const, state: primary }, { kind: "fastRestock" as const, state: primary }] };
    expect(validateDeal(fuel, three)[0]).toMatch(/two asks/);
    const twice = { ...d, gives: [{ kind: "adSpend" as const, perDay: 1000, days: 14 }, { kind: "adSpend" as const, perDay: 2000, days: 14 }] };
    expect(validateDeal(fuel, twice)[0]).toMatch(/once/);
  });
});

describe("the deal shapes the run", () => {
  it("moving stock into a state sets its day-1 stock there, and the split never changes the total", () => {
    const units = Math.floor(defaultDeal(fuel).stock["fuel-1"][primary] / 2);
    const d = move(defaultDeal(fuel), "fuel-1", primary, second, units);
    const run = dealToRun(fuel, d);
    const start = initialMarketState(withStartStock(fuel, run.startStock)).stock["fuel-1"];
    expect(start[second]).toBeCloseTo(defaultDeal(fuel).stock["fuel-1"][second] + units, 6);
    expect(total(start)).toBeCloseTo(stockPool(fuel)["fuel-1"], 6);
  });

  it("the same deal replays the same day exactly", () => {
    const d = move(defaultDeal(fuel), "fuel-1", primary, second, 20);
    const ctx = withStartStock(fuel, dealToRun(fuel, d).startStock);
    const a = stepDay(ctx, initialMarketState(ctx), [campaign()], { adjustments: dealToRun(fuel, d).adjustments });
    const b = stepDay(ctx, initialMarketState(ctx), [campaign()], { adjustments: dealToRun(fuel, d).adjustments });
    expect(a).toEqual(b);
  });

  it("asks become engine effects: more stores on day 1, a shelf boost, a restock on its day", () => {
    const d: DealTerms = { ...defaultDeal(fuel), asks: [{ kind: "moreStores", state: second }, { kind: "fastRestock", state: primary }] };
    const adj = dealToRun(fuel, d).adjustments;
    expect(adj.stockAdds.filter((s) => s.day === 1).every((s) => s.state === second && s.units > 0)).toBe(true);
    expect(adj.stockAdds.some((s) => s.day === FAST_RESTOCK_DAY && s.state === primary)).toBe(true);
    const shelf = dealToRun(fuel, { ...defaultDeal(fuel), asks: [{ kind: "shelfSpot" }] }).adjustments.shelfBoosts;
    expect(shelf).toEqual([{ fromDay: 1, toDay: SHELF_DAYS, relevanceMult: SHELF_BOOST }]);
  });

  it("busier dark stores: the same units reach more of that state's searches, all run, and nothing else changes", () => {
    const d: DealTerms = { ...defaultDeal(fuel), asks: [{ kind: "busyStores", state: primary }] };
    const adj = dealToRun(fuel, d).adjustments;
    expect(adj.storeReach).toEqual([{ state: primary, reachMult: BUSY_STORES_REACH }]);
    expect(adj.stockAdds).toEqual([]);

    const ctx = withStartStock(fuel, dealToRun(fuel, d).startStock);
    const lost = (r: DayResult, st: string) => r.cells.filter((c) => c.state === st).reduce((s, c) => s + c.lostToStock, 0);
    const searches = (r: DayResult, st: string) => r.cells.filter((c) => c.state === st).reduce((s, c) => s + c.searches, 0);
    const plain = stepDay(ctx, initialMarketState(ctx), [campaign()], { adjustments: dealToRun(fuel, defaultDeal(fuel)).adjustments }).result;
    const busy = stepDay(ctx, initialMarketState(ctx), [campaign()], { adjustments: adj }).result;
    expect(lost(busy, primary) / searches(busy, primary)).toBeLessThan(lost(plain, primary) / searches(plain, primary));
    expect(lost(busy, second)).toBeCloseTo(lost(plain, second), 6);
  });

  it("a funded discount cuts price for a week and gives up that much margin per unit", () => {
    const d: DealTerms = { ...defaultDeal(fuel), gives: [{ kind: "discount", skuIds: ["fuel-1"], pct: 0.1 }] };
    const [cut] = dealToRun(fuel, d).adjustments.priceCuts;
    const mrp = profile.skus.find((s) => s.id === "fuel-1")!.mrp;
    expect(cut).toEqual({ fromDay: 1, toDay: DISCOUNT_DAYS, skuIds: ["fuel-1"], pct: 0.1, marginPerUnit: { "fuel-1": Math.round(mrp * 0.1) } });
  });

  it("promises become tracked commitments", () => {
    const d: DealTerms = {
      ...defaultDeal(fuel),
      gives: [{ kind: "adSpend", perDay: 1500, days: 14 }, { kind: "supply", state: primary, osaPct: 60, byDay: 15 }],
    };
    const [spend, supply] = dealToRun(fuel, d).commitments;
    expect(spend).toMatchObject({ kind: "spend_at_least", target: 21000, fromDay: 1, dueDay: 14, askId: "opening_deal" });
    expect(supply).toMatchObject({ kind: "osa_at_least", target: 0.6, state: primary, dueDay: 15, askId: "opening_deal" });
    expect(spend.text).toContain("₹21,000");
    expect(supply.text).toContain(primary);
  });
});
