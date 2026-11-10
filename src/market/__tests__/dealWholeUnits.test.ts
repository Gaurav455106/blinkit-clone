// The deal sheet shows whole units. What the student can type must be what the
// send check accepts, for every brand: FIXES-TODO #1 (MunchBox and FuelUp
// refused a split that added up on screen).

import { describe, expect, it } from "vitest";
import { allowedStates, briefStock, defaultDeal, stockPool, unitsLeft, validateDeal, type DealTerms } from "@/market/deal";
import { testContext } from "@/market/__tests__/testContext";

const BRANDS = ["henlo", "glow", "vitaboost", "tinybuddy", "munchbox", "pawlife", "fuelup"] as const;

const withRow = (d: DealTerms, sku: string, row: Record<string, number>): DealTerms => ({ ...d, stock: { ...d.stock, [sku]: row } });

describe.each(BRANDS)("deal sheet stock for %s", (brand) => {
  const ctx = testContext(brand);
  const states = allowedStates(ctx);
  const pool = stockPool(ctx);
  const skus = ctx.scenario.profile.skus.map((s) => s.id);

  it("starts from a whole-unit split that places every unit", () => {
    const d = defaultDeal(ctx);
    for (const sku of skus) {
      for (const units of Object.values(d.stock[sku])) expect(Number.isInteger(units)).toBe(true);
      expect(unitsLeft(pool[sku], d.stock[sku], states)).toBe(0);
    }
    expect(validateDeal(ctx, d)).toEqual([]);
  });

  it("starts within one unit of the brief in every state", () => {
    const brief = briefStock(ctx);
    const d = defaultDeal(ctx);
    for (const sku of skus) {
      for (const [st, units] of Object.entries(brief[sku])) expect(Math.abs(d.stock[sku][st] - units)).toBeLessThan(1);
    }
  });

  it("accepts the starting boxes moved around, as long as the total shown is kept", () => {
    const d = defaultDeal(ctx);
    for (const sku of skus) {
      const row = d.stock[sku];
      const [from, to] = states;
      const moved = Math.floor((row[from] ?? 0) / 3);
      const next = { ...row, [from]: (row[from] ?? 0) - moved, [to]: (row[to] ?? 0) + moved };
      expect(validateDeal(ctx, withRow(d, sku, next))).toEqual([]);
      expect(unitsLeft(pool[sku], next, states)).toBe(0);
    }
  });

  it("accepts the whole pool in one state and refuses one unit more", () => {
    const d = defaultDeal(ctx);
    for (const sku of skus) {
      const all = Math.round(pool[sku]);
      const one = Object.fromEntries(states.map((st, i) => [st, i === 0 ? all : 0]));
      expect(validateDeal(ctx, withRow(d, sku, one))).toEqual([]);
      expect(unitsLeft(pool[sku], one, states)).toBe(0);
      const over = { ...one, [states[0]]: all + 1 };
      expect(validateDeal(ctx, withRow(d, sku, over))[0]).toMatch(/more than/);
      expect(unitsLeft(pool[sku], over, states)).toBe(-1);
    }
  });

  it("counts hidden decimals the way the screen shows them", () => {
    const d = defaultDeal(ctx);
    const sku = skus[0];
    const all = Math.round(pool[sku]);
    // A box showing "348" may hold 348.33; the student types the rest into another state
    const row = Object.fromEntries(states.map((st, i) => [st, i === 0 ? 100.4 : i === 1 ? all - 100 : 0]));
    expect(unitsLeft(pool[sku], row, states)).toBe(0);
    expect(validateDeal(ctx, withRow(d, sku, row))).toEqual([]);
  });
});
