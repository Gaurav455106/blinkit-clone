import { describe, it, expect } from "vitest";
import { earnedAchievements, newAchievements } from "@/components/game/achievements";
import type { CampaignConfig } from "@/market/engineTypes";
import type { LiveAction } from "@/market/actions";
import { cell, dayResult } from "@/market/__tests__/liveFixtures";

const launched: CampaignConfig[] = [{
  id: "c1", skuIds: ["x"], keywords: [{ term: "whey protein", exactBid: 400 }], placements: [{ id: "spotlight:home", bid: 450 }],
  geography: "pan_india", cities: [], budgetType: "daily", budget: 3000, launchDay: 1,
}];
const act = (change: LiveAction["change"], dayMade = 2): LiveAction => ({ campaignId: "c1", dayMade, change });
const base = { launched, actions: [] as LiveAction[], insights: 0, rohitReplies: 0, day: 1, results: [] as ReturnType<typeof dayResult>[] };

describe("achievements", () => {
  it("none before anything happens", () => {
    expect(earnedAchievements(base)).toEqual([]);
  });

  it("first move, night shift off, trimmed a loser, backed a winner", () => {
    const ids = earnedAchievements({ ...base, actions: [
      act({ kind: "schedule", schedule: [2, 3, 4, 5, 6, 7] }),
      act({ kind: "placementBid", id: "spotlight:home", bid: 250 }),
      act({ kind: "keywordBid", term: "whey protein", bid: 480 }),
    ] }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["first_move", "night_off", "trimmed", "backed_winner"]));
  });

  it("weeks, Rohit, insights and being in the black", () => {
    const results = [1, 2, 3].map((d) => dayResult(d, { cells: [cell({ spend: 100, contribution: 150 })] }));
    const ids = earnedAchievements({ ...base, day: 14, insights: 1, rohitReplies: 1, results }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["week_1", "week_2", "analyst", "rohit", "in_the_black"]));
    expect(ids).not.toContain("week_3");
  });

  it("reports only the ones not seen before", () => {
    const now = earnedAchievements({ ...base, day: 7 });
    expect(newAchievements(now, []).map((a) => a.id)).toEqual(["week_1"]);
    expect(newAchievements(now, ["week_1"])).toEqual([]);
  });
});
