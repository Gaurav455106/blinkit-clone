import { describe, it, expect } from "vitest";
import {
  shopperOutcome, priceEffect, affinity, fatigueMult, maxProfitableCPM,
  CHECKOUT_RATE, INDIRECT_REVENUE_RATE, type ShopperInputs,
} from "@/market/shoppers";

const whey: ShopperInputs = {
  viewableImpressions: 10_000,
  baseCTR: 0.02, creativeMult: 1, affinity: 1, fatigueMult: 1,
  baseCVR: 0.10, fit: 1.15, intent: 1.3, stateCVR: 1.2, priceEffect: 1,
  sellingPrice: 1299, contributionPerUnit: 400,
};

describe("shopperOutcome (F7)", () => {
  it("follows the chain impressions → clicks → ATCs → units → revenue", () => {
    const o = shopperOutcome(whey);
    expect(o.clicks).toBeCloseTo(10_000 * 0.02, 6);
    expect(o.atcs).toBeCloseTo(o.clicks * 0.10 * 1.15 * 1.3 * 1.2, 6);
    expect(o.units).toBeCloseTo(o.atcs * CHECKOUT_RATE, 6);
    expect(o.directRevenue).toBeCloseTo(o.units * 1299, 6);
    expect(o.contribution).toBeCloseTo(o.units * 400 * (1 + INDIRECT_REVENUE_RATE), 6);
  });

  it("adds indirect (halo) revenue on top of direct revenue (decision #20)", () => {
    const o = shopperOutcome(whey);
    expect(o.indirectRevenue).toBeCloseTo(o.directRevenue * INDIRECT_REVENUE_RATE, 6);
    expect(o.revenue).toBeCloseTo(o.directRevenue + o.indirectRevenue, 6);
  });

  it("doesn't use position: the same viewable impressions give the same clicks in any slot", () => {
    expect(shopperOutcome(whey).clicks).toBe(shopperOutcome({ ...whey }).clicks);
  });

  it("is zero with no impressions", () => {
    const o = shopperOutcome({ ...whey, viewableImpressions: 0 });
    expect(o.revenue).toBe(0);
    expect(o.contribution).toBe(0);
  });
});

describe("priceEffect", () => {
  it("does nothing without a cheaper rival on the page", () => {
    expect(priceEffect(1299, null)).toBe(1);
    expect(priceEffect(1299, 1499)).toBe(1);
  });

  it("starts at a 5% gap and reaches −30% at a 25% gap", () => {
    expect(priceEffect(1000, 950)).toBeCloseTo(1, 6);
    expect(priceEffect(1000, 850)).toBeCloseTo(1 - 0.3 * 0.5, 6);
    expect(priceEffect(1000, 750)).toBeCloseTo(0.7, 6);
    expect(priceEffect(1000, 500)).toBeCloseTo(0.7, 6);
  });
});

describe("affinity", () => {
  it("is 1.5 on the brand's own name", () => {
    expect(affinity(true, 0)).toBe(1.5);
  });

  it("grows up to +15% as reach builds", () => {
    expect(affinity(false, 0)).toBe(1);
    expect(affinity(false, 0.5)).toBeCloseTo(1.075, 6);
    expect(affinity(false, 3)).toBeCloseTo(1.15, 6);
  });
});

describe("fatigueMult (F10)", () => {
  it("is 1 up to a frequency of 3, then decays", () => {
    expect(fatigueMult(0)).toBe(1);
    expect(fatigueMult(3)).toBe(1);
    expect(fatigueMult(8)).toBeCloseTo(1 / 1.2, 6);
  });
});

describe("maxProfitableCPM (F4)", () => {
  it("is revenue per 1,000 viewable impressions × margin", () => {
    const inputs = { ...whey, intent: 1, stateCVR: 1 };
    const o = shopperOutcome({ ...inputs, viewableImpressions: 1000 });
    expect(maxProfitableCPM(inputs)).toBeCloseTo(o.contribution, 6);
  });

  it("is below the ₹200 floor for the FuelUp bar, so the bar can't be profitable on ads", () => {
    const bar = { ...whey, fit: 1.2, intent: 1, stateCVR: 1, sellingPrice: 99, contributionPerUnit: 15 };
    expect(maxProfitableCPM(bar)).toBeLessThan(200);
  });
});
