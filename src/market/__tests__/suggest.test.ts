import { describe, it, expect } from "vitest";
import { suggestKeywordRange, suggestSmartRange, suggestPlacementRange, monthlyVolume, preRunAuctions } from "@/market/suggest";
import { MIN_BID } from "@/market/auction";
import { testContext } from "./testContext";

const ctx = testContext("fuelup");

describe("suggested bid ranges (F3)", () => {
  it("are whole-₹10 ranges, never below the ₹200 minimum, low ≤ high", () => {
    for (const k of ctx.market.keywords) {
      const r = suggestKeywordRange(ctx, k.term);
      expect(r.lo).toBeGreaterThanOrEqual(MIN_BID);
      expect(r.hi).toBeGreaterThanOrEqual(r.lo);
      expect(r.lo % 10).toBe(0);
      expect(r.hi % 10).toBe(0);
    }
  });

  it("are identical on every call (no randomness between visits)", () => {
    expect(suggestKeywordRange(ctx, "whey protein")).toEqual(suggestKeywordRange(ctx, "whey protein"));
    expect(monthlyVolume(ctx, "whey protein")).toBe(monthlyVolume(ctx, "whey protein"));
  });

  it("reflect competition: a rival-heavy head term costs more than a long-tail term nobody bids on", () => {
    const head = suggestKeywordRange(ctx, "protein powder");
    const longTail = suggestKeywordRange(ctx, "vegan protein powder vanilla");
    expect(head.hi).toBeGreaterThan(longTail.hi);
  });

  it("long-tail terms clear near the ₹200 minimum (SPEC §3.2.1 calibration)", () => {
    for (const k of ctx.market.keywords.filter((x) => x.tier === "long" && !x.isBrandTerm)) {
      expect(suggestKeywordRange(ctx, k.term).lo).toBeLessThanOrEqual(260);
    }
  });

  it("bidding the top of the range wins slot 1 in at least 80% of pre-run searches", () => {
    for (const term of ["whey protein", "protein powder", "plant protein"]) {
      const { hi } = suggestKeywordRange(ctx, term);
      const pages = preRunAuctions(ctx, term);
      const totalWeight = pages.reduce((s, p) => s + p.weight, 0);
      const wonWeight = pages.filter((p) => hi * p.fit > p.topRank).reduce((s, p) => s + p.weight, 0);
      expect(wonWeight / totalWeight).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("smart-match ranges need a higher bid than exact for the same keyword (lower fit)", () => {
    const exact = suggestKeywordRange(ctx, "whey protein");
    const smart = suggestSmartRange(ctx, "whey protein");
    expect(smart.lo).toBeGreaterThanOrEqual(MIN_BID);
    expect(smart.hi).toBeGreaterThanOrEqual(exact.hi);
  });

  it("covers placements: category pages, Spotlight, Stories feeds, Rec Ads slots", () => {
    for (const p of ctx.market.placements) {
      const r = suggestPlacementRange(ctx, p.id);
      expect(r.lo).toBeGreaterThanOrEqual(MIN_BID);
      expect(r.hi).toBeGreaterThanOrEqual(r.lo);
    }
  });

  it("monthly volume is daily volume × 30 at normal season", () => {
    const k = ctx.market.keywords.find((x) => x.term === "whey protein")!;
    expect(monthlyVolume(ctx, "whey protein")).toBe(k.dailyVolume * 30);
  });
});
