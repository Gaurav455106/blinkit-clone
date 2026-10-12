import { describe, it, expect } from "vitest";
import { SCORING_GUIDE_V2 } from "@/lib/scoringGuide";
import { SCORE_V2_MAX } from "@/market/scoringV2";

describe("scoring guide", () => {
  it("covers every part, and each part's lines add up to its marks", () => {
    expect(SCORING_GUIDE_V2.map((p) => p.key).sort()).toEqual(Object.keys(SCORE_V2_MAX).sort());
    for (const part of SCORING_GUIDE_V2) {
      expect(part.max).toBe(SCORE_V2_MAX[part.key]);
      expect(part.lines.reduce((s, l) => s + l.max, 0)).toBe(part.max);
    }
  });

  it("totals 100", () => {
    expect(SCORING_GUIDE_V2.reduce((s, p) => s + p.max, 0)).toBe(100);
  });
});
