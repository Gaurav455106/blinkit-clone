import { describe, expect, it } from "vitest";
import { campaignSkuIds, enabledCategories } from "@/lib/wizardSave";

const CATS = ["Dog Needs", "Pet Food & Accessories"];

describe("enabledCategories", () => {
  it("keeps categories the student never touched, since they show as ticked", () => {
    expect(enabledCategories(CATS, {}, true)).toEqual(CATS);
  });

  it("drops only the categories the student unticked", () => {
    expect(enabledCategories(CATS, { "Pet Food & Accessories": false }, true)).toEqual(["Dog Needs"]);
  });

  it("returns none when category targeting is switched off", () => {
    expect(enabledCategories(CATS, { "Dog Needs": true }, false)).toEqual([]);
  });

  it("ignores stale flags for categories this brand does not have", () => {
    expect(enabledCategories(CATS, { "Baby Care": true }, true)).toEqual(CATS);
  });
});

describe("campaignSkuIds", () => {
  const base = { selectedSkus: ["a-1", "a-2"], storyVariant: null, storySku: null, spotlightMode: null, spotlightProducts: [] };

  it("uses the products picked in the product step for Product Booster", () => {
    expect(campaignSkuIds("product_booster", base)).toEqual(["a-1", "a-2"]);
  });

  it("uses the single story product for a single-product Stories ad", () => {
    expect(campaignSkuIds("stories", { ...base, storyVariant: "single", storySku: "a-3" })).toEqual(["a-3"]);
  });

  it("uses the manual collection for Listing Spotlight", () => {
    expect(campaignSkuIds("listing_spotlight", { ...base, spotlightMode: "manual", spotlightProducts: ["a-2"] })).toEqual(["a-2"]);
  });

  it("returns none (all products) for a Spotlight collection that is not manual", () => {
    expect(campaignSkuIds("listing_spotlight", { ...base, spotlightMode: "existing", spotlightProducts: ["a-2"] })).toEqual([]);
  });
});
