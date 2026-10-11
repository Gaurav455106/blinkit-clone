import { describe, it, expect } from "vitest";
import { initialMarketState } from "@/market/state";
import { runHeadless } from "@/market/headless";
import * as S from "@/market/calibration/strategies";
import { TARGET_COVER_DAYS } from "@/market/stock";
import { testContext } from "@/market/__tests__/testContext";
import type { MarketContext } from "@/market/engineTypes";
import type { InventoryState } from "@/data/scenarios";

const withTone = (ctx: MarketContext, tone: InventoryState["tone"]): MarketContext => ({
  ...ctx,
  scenario: { ...ctx.scenario, inventory: { ...ctx.scenario.inventory, tone } },
});

const totalUnits = (ctx: MarketContext, skuId: string) =>
  Object.values(initialMarketState(ctx).stock[skuId]).reduce((s, u) => s + u, 0);

describe("starting stock follows the brief's stock label (SPEC §13 #32)", () => {
  const ctx = testContext("fuelup");
  const sku = ctx.scenario.profile.skus[0].id;

  it("scales with the label's days of cover", () => {
    const healthy = totalUnits(withTone(ctx, "healthy"), sku);
    const over = totalUnits(withTone(ctx, "overstocked"), sku);
    const critical = totalUnits(withTone(ctx, "critical"), sku);
    expect(over / healthy).toBeCloseTo(TARGET_COVER_DAYS.overstocked / TARGET_COVER_DAYS.healthy, 5);
    expect(critical / healthy).toBeCloseTo(TARGET_COVER_DAYS.critical / TARGET_COVER_DAYS.healthy, 5);
  });

  it("splits units across states by the brief's per-state stock, and none where there is no stock", () => {
    const stock = initialMarketState(ctx).stock[sku];
    const map = ctx.scenario.cityStockMap;
    const p = ctx.scenario.profile;
    const [second] = p.secondaryStates;
    expect(stock[p.primaryState] / stock[second]).toBeCloseTo(map[p.primaryState] / map[second], 5);
    const empty = Object.keys(map).find((s) => (map[s as keyof typeof map] ?? 0) === 0)!;
    expect(stock[empty]).toBe(0);
  });

  it("a deal's stock still overrides the starting split", () => {
    const deal = { ...ctx, startStock: { [sku]: { [ctx.scenario.profile.primaryState]: 7 } } };
    expect(initialMarketState(deal).stock[sku][ctx.scenario.profile.primaryState]).toBe(7);
  });
});

describe("healthy stock lasts to the first restock", () => {
  for (const brand of ["henlo", "munchbox", "tinybuddy", "fuelup"]) {
    it(`${brand}: no stocked state drops below 20% of stores before day 7`, () => {
      const ctx = testContext(brand);
      const run = runHeadless(ctx, S.naive(ctx));
      const early = run.results.filter((r) => r.day < 7).flatMap((r) => r.stock).filter((x) => x.opening > 0);
      expect(early.every((x) => x.osa >= 0.2)).toBe(true);
    });
  }
});

describe("restocks are sized from demand, not from what sold", () => {
  it("a state that ran out is refilled on the restock day", () => {
    const ctx = testContext("munchbox");
    const p = ctx.scenario.profile;
    const tiny = Object.fromEntries(p.skus.map((s) => [s.id, { [p.primaryState]: 3 }]));
    const run = runHeadless({ ...ctx, startStock: tiny }, S.naive(ctx));
    const day7 = run.results.find((r) => r.day === 7)!.stock.find((x) => x.skuId === p.skus[0].id && x.state === p.primaryState)!;
    expect(day7.restocked).toBeGreaterThan(50);
    expect(day7.osa).toBeGreaterThan(0.5);
  });
});
