import { describe, it, expect } from "vitest";
import { plainText, lineGuide, lineTier, qualitativeSummary, categoryLabel, RUBRICS, SCORE_SCHEMES } from "@/lib/rubrics";
import { attemptLines, attemptTotals, attemptVersion, categoryStats, lineStats, filterAttempts, versionsPresent, type AttemptRow } from "@/lib/attemptAnalysis";
import { buildCohortSheets } from "@/lib/profileExport";

const v2Line = {
  key: "bid_moments", category: "live", label: "Bid decisions", earned: 10, max: 20,
  judgedOn: "Whether you raised bids when a profitable keyword lost its top spot — in time.",
  howToImprove: "Raise bids on keywords that make a profit when you start losing the top spot.",
  note: "You acted late on two of four moments.",
  tiers: [
    { points: 0, condition: "Ignored every moment." },
    { points: 20, condition: "Acted in time on every moment." },
    { points: 19, minPoints: 1, condition: "Acted on some moments, or late." },
  ],
};

const v2Row: AttemptRow = {
  id: "v2", name: "Meera Iyer", email: "meera@x.com", batch_code: "B9", profile_id: "fuelup", score_total: 70,
  created_at: "2026-11-01T10:00:00Z",
  score_breakdown: { version: 2, setup: 20, live: 20, eventsRohit: 15, results: 15, lines: [v2Line] },
};
const v1Row: AttemptRow = {
  id: "v1", name: "Meera Iyer", email: "meera@x.com", batch_code: "B9", profile_id: "fuelup", score_total: 50,
  created_at: "2026-10-01T10:00:00Z", score_breakdown: { setup: 20, liveOpt: 10, crisis: 12, results: 8 },
};

describe("plainText", () => {
  it("removes em dashes", () => {
    expect(plainText("Ran all campaigns on 24/7 — dead hours burned budget.")).toBe("Ran all campaigns on 24/7. Dead hours burned budget.");
    expect(plainText("Good — ")).toBe("Good.");
    expect(plainText("Supply Alert — Day 9")).toBe("Supply Alert: Day 9");
    expect(plainText("No dashes here.")).toBe("No dashes here.");
    expect(plainText("You chose product_booster.")).toBe("You chose Product Booster.");
  });

  it("leaves no em dash in any v1 rubric text", () => {
    for (const r of RUBRICS) {
      const text = [r.label, r.judgedOn, r.howToImprove, r.trainerTip, ...r.tiers.flatMap((t) => [t.condition, t.short])].join(" ");
      expect(text).not.toContain("—");
      expect(text.toLowerCase()).not.toContain("tier");
    }
  });
});

describe("version 2 lines", () => {
  it("parses a v2 line with its own guide, sorted levels and no em dashes", () => {
    const lines = attemptLines(v2Row)!;
    expect(lines[0].category).toBe("live");
    expect(lines[0].tiers!.map((t) => t.points)).toEqual([20, 19, 0]);
    expect(lines[0].judgedOn).not.toContain("—");
    const guide = lineGuide(lines[0]);
    expect(guide.howToImprove).toMatch(/Raise bids/);
    expect(lineTier(lines[0])!.minPoints).toBe(1);
  });

  it("reads v2 totals and keeps versions apart", () => {
    expect(attemptVersion(v2Row)).toBe(2);
    expect(attemptTotals(v2Row)).toEqual({ setup: 20, live: 20, eventsRohit: 15, results: 15 });
    expect(versionsPresent([v1Row, v2Row])).toEqual([2, 1]);
    expect(filterAttempts([v1Row, v2Row], { version: 2 })).toHaveLength(1);
    const stats = categoryStats([v1Row, v2Row], 2);
    expect(stats.map((s) => s.max)).toEqual([25, 35, 20, 20]);
    expect(stats[1].avg).toBe(20);
    expect(categoryStats([v1Row, v2Row], 1)[0].n).toBe(1);
  });

  it("builds line statistics from the line's own levels", () => {
    const [s] = lineStats([v2Row]);
    expect(s.key).toBe("bid_moments");
    expect(s.tiers.find((t) => t.points === 19)!.count).toBe(1);
    expect(s.howToImprove).toMatch(/Raise bids/);
  });

  it("summarises by the v2 categories", () => {
    const summary = qualitativeSummary(attemptLines(v2Row)!, 2);
    expect(summary.map((s) => s.label)).toEqual(SCORE_SCHEMES[2].map((c) => c.label));
    expect(summary[1].paragraph).toMatch(/Raise bids/);
    expect(categoryLabel("eventsRohit", 2)).toBe("Market events and Rohit");
  });

  it("exports v2 line columns", () => {
    const sheets = buildCohortSheets([v2Row]);
    expect(sheets[0].rows[0]["Bid decisions (pts)"]).toBe(10);
  });
});
