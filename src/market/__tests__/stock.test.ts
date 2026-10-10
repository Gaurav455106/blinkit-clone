import { describe, it, expect } from "vitest";
import {
  osa, initialUnits, organicDemand, restockAmount, isRestockDay, sellFrom,
  SAFETY_UNITS_PER_STORE, TARGET_COVER_DAYS, RESTOCK_INTERVAL_DAYS,
} from "@/market/stock";

describe("osa (F6)", () => {
  it("is the share of dark stores in stock, from units", () => {
    const stores = 40;
    const full = stores * SAFETY_UNITS_PER_STORE.Low;
    expect(osa(full, stores, "Low")).toBe(1);
    expect(osa(full * 2, stores, "Low")).toBe(1);
    expect(osa(full / 2, stores, "Low")).toBeCloseTo(0.5, 6);
    expect(osa(0, stores, "Low")).toBe(0);
  });

  it("is 0 in a state with no dark stores", () => {
    expect(osa(100, 0, "Low")).toBe(0);
  });
});

describe("initialUnits", () => {
  it("reproduces the scenario's starting OSA", () => {
    const units = initialUnits(80, 40, "Medium");
    expect(osa(units, 40, "Medium")).toBeCloseTo(0.8, 6);
    expect(initialUnits(0, 40, "Medium")).toBe(0);
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
