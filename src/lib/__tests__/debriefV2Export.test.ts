import { describe, it, expect } from "vitest";
import { debriefSheets, debriefFilename } from "@/lib/debriefV2Export";
import type { ScoreV2 } from "@/market/scoringV2";
import { testContext } from "@/market/__tests__/testContext";

const ctx = testContext("fuelup");

const score = {
  version: 2,
  lines: [{ key: "v2_events", category: "eventsRohit", label: "Response to alerts", earned: 2, max: 5, judgedOn: "Moves", tiers: [], note: "Late.", howToImprove: "Act sooner." }],
  totals: { setup: 20, live: 20, eventsRohit: 10, results: 10 }, grandTotal: 60,
  moments: [{
    moment: { id: "m", type: "sovDrop", day: 9, campaignId: "c1", subject: "whey protein", title: "SOV fell on whey protein", evidence: "SOV 41% to 17%", window: 3, levers: [] },
    points: 0, max: 5, studentAction: null, bestLever: "Raise the bid 15%", gainVsNothing: 0, bestGainVsNothing: 4200, verdict: "ignored",
  }],
  costliestMistakes: [{ title: "Day 9: SOV fell on whey protein", lost: 4200, what: "No action" }],
  run: {} as never,
  goalRows: [{ label: "ROAS", goal: 3, actual: 2.4, unit: "x", pct: 80 }],
  achievementPct: 80,
} as unknown as ScoreV2;

describe("debriefSheets", () => {
  const sheets = debriefSheets(score, { ctx, results: [], configsByDay: [], campaignNames: {}, changeLog: [] });

  it("starts with the score, moments, mistakes and goals, then the R1–R12 reports", () => {
    expect(sheets.slice(0, 4).map((s) => s.name)).toEqual(["Score lines", "Decision moments", "Costliest mistakes", "Client goals"]);
    expect(sheets.length).toBeGreaterThan(4);
  });

  it("keeps numbers as numbers and uses plain verdict words", () => {
    const line = sheets[0].rows[0];
    expect(line["Points"]).toBe(2);
    expect(line["Out of"]).toBe(5);
    const moment = sheets[1].rows[0];
    expect(moment["Verdict"]).toBe("No response in time");
    expect(moment["Best move would gain"]).toBe(4200);
    expect(sheets[2].rows[0]["Lost vs best move"]).toBe(4200);
  });

  it("names the file after the student and brand", () => {
    expect(debriefFilename("Asha K", "FuelUp")).toBe("blinkit-results-v2-Asha-K-FuelUp");
  });
});
