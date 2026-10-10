import { describe, it, expect } from "vitest";
import { MARKET_DATA } from "@/market/data";
import { SLOT_COUNT } from "@/market/types";
import { SLOT_LABELS } from "@/market/slots";
import { expectedPlacementIds, VIEW_RATES_BY_KIND } from "@/market/placements";
import { BRAND_PROFILES, BLINKIT_STATES } from "@/data/scenarios";

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

describe("slots", () => {
  it("slot 0 is 12–3 AM and there are 8 slots", () => {
    expect(SLOT_LABELS).toHaveLength(SLOT_COUNT);
    expect(SLOT_LABELS[0]).toBe("12–3 AM");
    expect(SLOT_LABELS[6]).toBe("6–9 PM");
  });
});

describe("placement view rates", () => {
  it("keyword pages show 3 ads, category and recommendation 2, Spotlight and Stories 1", () => {
    expect(VIEW_RATES_BY_KIND.keyword).toHaveLength(3);
    expect(VIEW_RATES_BY_KIND.category).toHaveLength(2);
    expect(VIEW_RATES_BY_KIND.recommendation).toHaveLength(2);
    expect(VIEW_RATES_BY_KIND.spotlight).toEqual([1]);
    expect(VIEW_RATES_BY_KIND.stories).toEqual([1]);
  });
});

describe("MARKET_DATA", () => {
  it("every entry matches a brand profile", () => {
    for (const id of Object.keys(MARKET_DATA)) {
      expect(BRAND_PROFILES.some((b) => b.id === id)).toBe(true);
    }
  });

  it.todo("covers all 7 brands (FuelUp first, others in slice 1c follow-ups)");

  for (const [brandId, m] of Object.entries(MARKET_DATA)) {
    const profile = BRAND_PROFILES.find((b) => b.id === brandId)!;
    const skuIds = profile.skus.map((s) => s.id);
    const terms = m.keywords.map((k) => k.term);

    describe(brandId, () => {
      it("category slot shares sum to 1 and every per-slot array has 8 positive values", () => {
        const c = m.category;
        expect(sum(c.slotShare)).toBeCloseTo(1, 6);
        for (const arr of [c.slotShare, c.intent, c.rivalPressure]) {
          expect(arr).toHaveLength(SLOT_COUNT);
          expect(arr.every((x) => x > 0)).toBe(true);
        }
      });

      it("CTR, CVR and background bidders are in sane ranges", () => {
        const c = m.category;
        expect(c.baseCTR).toBeGreaterThan(0.005);
        expect(c.baseCTR).toBeLessThan(0.08);
        expect(c.baseCVR).toBeGreaterThan(0.02);
        expect(c.baseCVR).toBeLessThan(0.4);
        expect(c.backgroundBidMedian).toBeGreaterThanOrEqual(200);
        expect(c.backgroundBidderCount[0]).toBeGreaterThanOrEqual(3);
        expect(c.backgroundBidderCount[1]).toBeGreaterThanOrEqual(c.backgroundBidderCount[0]);
      });

      it("has 10–14 unique keywords with head, mid and long-tail tiers", () => {
        expect(m.keywords.length).toBeGreaterThanOrEqual(10);
        expect(m.keywords.length).toBeLessThanOrEqual(14);
        expect(new Set(terms).size).toBe(terms.length);
        const tiers = m.keywords.map((k) => k.tier);
        expect(tiers.filter((t) => t === "head").length).toBeGreaterThanOrEqual(2);
        expect(tiers.filter((t) => t === "long").length).toBeGreaterThanOrEqual(3);
      });

      it("keeps every keyword the v1 wizard already suggests", () => {
        for (const k of [...profile.goodKeywords, ...profile.riskyKeywords]) expect(terms).toContain(k);
      });

      it("has a brand-name keyword", () => {
        expect(m.keywords.some((k) => k.isBrandTerm && k.term.includes(profile.name.toLowerCase().split(" ")[0]))).toBe(true);
      });

      it("gives every keyword a fit for every SKU, with at least one SKU that can serve it", () => {
        for (const k of m.keywords) {
          expect(Object.keys(k.fit).sort()).toEqual([...skuIds].sort());
          expect(Object.values(k.fit).every((f) => f >= 0 && f <= 1.3)).toBe(true);
          expect(Math.max(...Object.values(k.fit))).toBeGreaterThan(0);
          expect(k.dailyVolume).toBeGreaterThan(0);
        }
      });

      it("head terms have more volume than long-tail terms", () => {
        const minHead = Math.min(...m.keywords.filter((k) => k.tier === "head" && !k.isBrandTerm).map((k) => k.dailyVolume));
        const maxLong = Math.max(...m.keywords.filter((k) => k.tier === "long" && !k.isBrandTerm).map((k) => k.dailyVolume));
        expect(minHead).toBeGreaterThan(maxLong);
      });

      it("rivals bid only on known keywords and have valid settings", () => {
        expect(m.rivals.length).toBeGreaterThanOrEqual(2);
        for (const r of m.rivals) {
          for (const t of Object.keys(r.bids)) expect(terms).toContain(t);
          expect(Object.values(r.bids).every((b) => b >= 200)).toBe(true);
          expect(r.targetSov).toBeGreaterThan(0);
          expect(r.targetSov).toBeLessThanOrEqual(0.54);
          expect(r.relevance).toBeGreaterThanOrEqual(0.6);
          expect(r.relevance).toBeLessThanOrEqual(1.3);
          expect(r.maxBidMult).toBeGreaterThanOrEqual(1);
          expect(r.contributionPerUnit).toBeLessThan(r.price);
        }
      });

      it("state multipliers name real states", () => {
        for (const s of [...Object.keys(m.stateCVR), ...Object.keys(m.stateAffinity)]) {
          expect((BLINKIT_STATES as readonly string[]).includes(s)).toBe(true);
        }
      });

      it("has exactly the placements the wizard offers (categories, Spotlight, Stories feeds, Rec Ads slots)", () => {
        expect(m.placements.map((p) => p.id).sort()).toEqual([...expectedPlacementIds(profile)].sort());
      });

      it("gives every placement volume, sane multipliers and a fit for each SKU", () => {
        for (const p of m.placements) {
          expect(p.dailyVolume).toBeGreaterThan(0);
          expect(p.ctrMult).toBeGreaterThan(0);
          expect(p.cvrMult).toBeGreaterThan(0);
          expect(Object.keys(p.fit).sort()).toEqual([...skuIds].sort());
          expect(Math.max(...Object.values(p.fit))).toBeGreaterThan(0);
        }
      });

      it("rival placement bids name real placements", () => {
        const ids = m.placements.map((p) => p.id);
        for (const r of m.rivals) {
          for (const [id, bid] of Object.entries(r.placementBids ?? {})) {
            expect(ids).toContain(id);
            expect(bid).toBeGreaterThanOrEqual(200);
          }
        }
      });

      it("has organic daily units for every SKU", () => {
        expect(Object.keys(m.organicDailyUnits).sort()).toEqual([...skuIds].sort());
      });
    });
  }
});
