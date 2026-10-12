import { describe, expect, it } from "vitest";
import { pickCostliest } from "@/market/scoringV2";
import { formatObjective, objectiveUnit, type MomentScore } from "@/market/moments";

const score = (day: number, campaignId: string, lost: number, bestLever = "Raise the bid"): MomentScore => ({
  moment: { day, campaignId, title: `Moment ${day}` } as MomentScore["moment"],
  points: 0, max: 5, studentAction: null, bestLever,
  gainVsNothing: 0, bestGainVsNothing: lost, verdict: "ignored",
});

describe("pickCostliest", () => {
  it("drops a repeat on the same campaign with the same lever and loss", () => {
    const out = pickCostliest([score(3, "c1", 5000), score(4, "c1", 5000), score(5, "c2", 900)], "₹");
    expect(out.map((m) => m.title)).toEqual(["Day 3: Moment 3", "Day 5: Moment 5"]);
  });

  it("keeps the same loss when the lever differs", () => {
    expect(pickCostliest([score(3, "c1", 5000), score(4, "c1", 5000, "Cut the budget")], "₹")).toHaveLength(2);
  });

  it("skips moments that lost nothing and carries the unit", () => {
    const out = pickCostliest([score(3, "c1", 0), score(4, "c1", 1200)], "views");
    expect(out).toEqual([{ title: "Day 4: Moment 4", lost: 1200, what: "No action", unit: "views" }]);
  });
});

describe("objective units", () => {
  it("names the unit each goal type is scored in", () => {
    expect(objectiveUnit("ROAS-First")).toBe("₹");
    expect(objectiveUnit("Volume-First")).toBe("units");
    expect(objectiveUnit("Awareness-First")).toBe("views");
    expect(formatObjective(45000, "views")).toBe("45,000 views");
    expect(formatObjective(1234.4)).toBe("₹1,234");
  });
});
