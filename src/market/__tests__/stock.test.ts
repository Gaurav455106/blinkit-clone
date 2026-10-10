import { describe, it, expect } from "vitest";
import {
  osa, initialUnits, organicDemand, restockAmount, isRestockDay, sellFrom,
  SAFETY_UNITS_PER_STORE, TARGET_COVER_DAYS, RESTOCK_INTERVAL_DAYS,
} from "@/market/stock";

describe("osa (F6)", () => {
  it("is 0 with no units and rises towards 1 as units per store grow", () => {
    const stores = 40;
    expect(osa(0, stores, "Low")).toBe(0);
    const levels = [10, 40, 80, 200, 1000].map((u) => osa(u, stores, "Low"));
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    expect(levels[levels.length - 1]).toBeGreaterThan(0.99);
    expect(levels[levels.length - 1]).toBeLessThanOrEqual(1);
  });

  it("is about 63% when each store holds k units", () => {
    expect(osa(40 * SAFETY_UNITS_PER_STORE.Medium, 40, "Medium")).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  it("is 0 in a state with no dark stores", () => {
    expect(osa(100, 0, "Low")).toBe(0);
  });

  it("lands near 86% / 61% / 32% OSA at healthy / shaky / critical cover for a typical state", () => {
    // 53 stores, ~5 units sold a day, Low velocity (k = 1 unit per store)
    const at = (days: number) => osa(5 * days, 53, "Low");
    expect(at(TARGET_COVER_DAYS.healthy)).toBeGreaterThan(0.8);
    expect(at(TARGET_COVER_DAYS.warning)).toBeGreaterThan(0.5);
    expect(at(TARGET_COVER_DAYS.warning)).toBeLessThan(0.7);
    expect(at(TARGET_COVER_DAYS.critical)).toBeLessThan(0.4);
  });
});

describe("initialUnits", () => {
  it("reproduces the scenario's starting OSA", () => {
    const units = initialUnits(80, 40, "Medium");
    expect(osa(units, 40, "Medium")).toBeCloseTo(0.8, 6);
    expect(initialUnits(0, 40, "Medium")).toBe(0);
  });

  it("treats 100% OSA as 99% so units stay finite", () => {
    expect(Number.isFinite(initialUnits(100, 40, "Medium"))).toBe(true);
    expect(osa(initialUnits(100, 40, "Medium"), 40, "Medium")).toBeCloseTo(0.99, 6);
  });
});

describe("organicDemand", () => {
  it("scales national organic units by state share, weekday, season and a small SOV halo", () => {
    expect(organicDemand(100, 0.1, 1, 1, 0)).toBeCloseTo(10, 6);
    expect(organicDemand(100, 0.1, 1, 1, 0.5)).toBeCloseTo(10.5, 6);
  });
});

describe("sellFrom", () => {
  it("never sells more than is in stock", () => {
    expect(sellFrom(10, 4)).toEqual({ sold: 4, remaining: 6 });
    expect(sellFrom(3, 8)).toEqual({ sold: 3, remaining: 0 });
  });
});

describe("restock", () => {
  it("happens every 7 days", () => {
    expect(isRestockDay(RESTOCK_INTERVAL_DAYS)).toBe(true);
    expect(isRestockDay(RESTOCK_INTERVAL_DAYS * 2)).toBe(true);
    expect(isRestockDay(1)).toBe(false);
  });

  it("tops up to the inventory's target days of cover", () => {
    expect(restockAmount(20, 5, "healthy")).toBe(5 * TARGET_COVER_DAYS.healthy - 20);
    expect(restockAmount(500, 5, "healthy")).toBe(0);
    expect(TARGET_COVER_DAYS.critical).toBeLessThan(TARGET_COVER_DAYS.warning);
  });
});
