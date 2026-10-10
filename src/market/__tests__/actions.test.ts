import { describe, it, expect } from "vitest";
import { applyActions, recordAction, type LiveAction } from "@/market/actions";
import type { CampaignConfig } from "@/market/engineTypes";

const base: CampaignConfig = {
  id: "c1", skuIds: ["fuel-1"],
  keywords: [{ term: "whey protein", exactBid: 450 }, { term: "protein bar", exactBid: 400 }],
  placements: [{ id: "category:Sports Nutrition", bid: 420 }],
  geography: "pan_india", cities: [], budgetType: "daily", budget: 5000, launchDay: 1,
};

describe("live actions (SPEC §7: apply from the next day)", () => {
  it("only takes effect from the day after it was made", () => {
    const a: LiveAction = { campaignId: "c1", dayMade: 5, change: { kind: "budget", budget: 8000 } };
    expect(applyActions([base], [a], 5)[0].budget).toBe(5000);
    expect(applyActions([base], [a], 6)[0].budget).toBe(8000);
  });

  it("changes keyword bids, pauses keywords and changes placement bids", () => {
    const actions: LiveAction[] = [
      { campaignId: "c1", dayMade: 1, change: { kind: "keywordBid", term: "whey protein", bid: 520 } },
      { campaignId: "c1", dayMade: 1, change: { kind: "pauseKeyword", term: "protein bar", paused: true } },
      { campaignId: "c1", dayMade: 1, change: { kind: "placementBid", id: "category:Sports Nutrition", bid: 300 } },
    ];
    const [c] = applyActions([base], actions, 2);
    expect(c.keywords).toEqual([{ term: "whey protein", exactBid: 520 }]);
    expect(c.placements).toEqual([{ id: "category:Sports Nutrition", bid: 300 }]);
  });

  it("adds keywords, changes states, schedule and pause, and later actions win", () => {
    const actions: LiveAction[] = [
      { campaignId: "c1", dayMade: 1, change: { kind: "addKeyword", term: "whey isolate unflavoured 1kg", bid: 260 } },
      { campaignId: "c1", dayMade: 1, change: { kind: "states", geography: "select_cities", cities: ["Karnataka"] } },
      { campaignId: "c1", dayMade: 1, change: { kind: "schedule", schedule: [2, 6, 7] } },
      { campaignId: "c1", dayMade: 2, change: { kind: "pause", paused: true } },
      { campaignId: "c1", dayMade: 3, change: { kind: "pause", paused: false } },
    ];
    const [c] = applyActions([base], actions, 4);
    expect(c.keywords.map((k) => k.term)).toContain("whey isolate unflavoured 1kg");
    expect(c.geography).toBe("select_cities");
    expect(c.cities).toEqual(["Karnataka"]);
    expect(c.schedule).toEqual([2, 6, 7]);
    expect(c.paused).toBe(false);
  });

  it("never mutates the original campaigns", () => {
    const copy = JSON.parse(JSON.stringify(base));
    applyActions([base], [{ campaignId: "c1", dayMade: 1, change: { kind: "budget", budget: 1 } }], 5);
    expect(base).toEqual(copy);
  });

  it("records a readable change-log entry with from → to", () => {
    const entry = recordAction([base], { campaignId: "c1", dayMade: 4, change: { kind: "keywordBid", term: "whey protein", bid: 520 } });
    expect(entry).toMatchObject({ dayMade: 4, dayApplied: 5, campaignId: "c1", what: "Bid on \"whey protein\"", from: "₹450", to: "₹520" });
  });
});
