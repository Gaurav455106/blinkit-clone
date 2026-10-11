import { describe, it, expect } from "vitest";
import { spendByFormat, keywordSov } from "@/components/live/overviewData";
import { cell, dayResult } from "@/market/__tests__/liveFixtures";

describe("spendByFormat", () => {
  it("adds spend per ad format and gives each its share", () => {
    const results = [dayResult(1, { cells: [cell({ campaignId: "a", spend: 300 }), cell({ campaignId: "b", spend: 100 })] })];
    const rows = spendByFormat(results, { a: "product_booster", b: "listing_spotlight" });
    expect(rows).toEqual([
      { format: "product_booster", label: "Product Booster", spend: 300, share: 0.75 },
      { format: "listing_spotlight", label: "Listing Spotlight", spend: 100, share: 0.25 },
    ]);
  });

  it("is empty before anything is spent", () => {
    expect(spendByFormat([], {})).toEqual([]);
  });
});

describe("keywordSov", () => {
  it("lists keywords with searches and real share of voice over the last 7 days, marked good or risky", () => {
    const old = dayResult(1, { cells: [cell({ term: "whey protein", searches: 999, viewableImpressions: 999, totalAdViewable: 999 })] });
    const recent = [2, 3, 4, 5, 6, 7, 8].map((d) => dayResult(d, { cells: [
      cell({ term: "whey protein", searches: 100, viewableImpressions: 30, totalAdViewable: 100 }),
      cell({ term: "fuelup", searches: 10, viewableImpressions: 5, totalAdViewable: 10 }),
      cell({ inventory: "spotlight", term: "spotlight:home", searches: 50 }),
    ] }));
    const rows = keywordSov([old, ...recent], ["whey protein"], ["fuelup"]);
    expect(rows).toEqual([
      { term: "whey protein", searches: 700, sov: 0.3, kind: "good" },
      { term: "fuelup", searches: 70, sov: 0.5, kind: "risky" },
    ]);
  });
});
