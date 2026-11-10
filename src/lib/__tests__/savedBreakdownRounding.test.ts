import { describe, expect, it } from "vitest";
import { buildSavedBreakdownV2 } from "@/lib/attemptAnalysis";
import type { ScoreV2 } from "@/market/scoringV2";

// The total is rounded once, and the grade comes from that same number, so the
// debrief, the saved row (score_total is a whole number) and staff views agree.
const score = (grandTotal: number) => ({
  grandTotal,
  totals: { setup: 15, live: 20, eventsRohit: 14, results: grandTotal - 49 },
  achievementPct: 80,
  lines: [],
  goalRows: [],
  costliestMistakes: [],
}) as unknown as ScoreV2;

describe("buildSavedBreakdownV2 total and grade", () => {
  it("rounds 59.5 up to 60 and grades it as 60", () => {
    const saved = buildSavedBreakdownV2(score(59.5));
    expect(saved.grandTotal).toBe(60);
    expect(saved.gradeLabel).toBe("Growing Fast");
  });

  it("rounds 74.4 down to 74 and grades it as 74", () => {
    const saved = buildSavedBreakdownV2(score(74.4));
    expect(saved.grandTotal).toBe(74);
    expect(saved.gradeLabel).toBe("Growing Fast");
  });
});
