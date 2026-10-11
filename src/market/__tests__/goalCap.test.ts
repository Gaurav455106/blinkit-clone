import { describe, it, expect } from "vitest";
import { goalAchievement } from "@/market/scoringV2";

describe("client goals: beating one can't hide missing another", () => {
  it("caps each goal at 100% before averaging", () => {
    // Glow playthrough: CTR 150%, units 83%, views 39%
    const avg = goalAchievement([1.5, 0.83, 0.39]);
    expect(avg).toBeCloseTo((1 + 0.83 + 0.39) / 3, 6);
    expect(avg).toBeLessThan(0.9);
  });

  it("is 0 with no goals", () => {
    expect(goalAchievement([])).toBe(0);
  });
});
