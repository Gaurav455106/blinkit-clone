import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildResultsSheets, RESULTS_README, scheduleText, resultsFilename, type ResultsExportInput } from "@/lib/resultsExport";
import { buildWorkbook } from "@/lib/excel";
import { RUBRICS, type LineResult } from "@/lib/rubrics";
import type { SavedCampaign } from "@/context/SimContext";

const lines: LineResult[] = RUBRICS.map((r) => ({
  key: r.key, label: r.label, category: r.category,
  earned: r.key === "dayparting" ? 0 : r.max, max: r.max,
  note: r.key === "dayparting" ? "Ran all campaigns on 24/7." : "Good.",
}));

const campaign: SavedCampaign = {
  id: "c1", name: "Hero push", objective: "performance", adFormat: "product_booster",
  cities: ["Karnataka", "Delhi"], skuIds: ["s1"], keywords: ["dog treats", "chew sticks"],
  budget: 5000, budgetType: "daily", geography: "select_cities", dayparting: [2, 3, 4, 5, 6, 7],
};

const input: ResultsExportInput = {
  student: { name: "Ritika Menon", email: "ritika@x.com", batch: "B7" },
  brand: "Henlo", grandTotal: 85, gradeLabel: "Sharp Strategist", achievementPct: 82,
  lines,
  goalRows: [{ label: "ROAS", goal: 4, actual: 3.456, unit: "x", pct: 86 }],
  campaigns: [campaign, { ...campaign, id: "d", name: "Draft", isDraft: true }],
  perCampaign: [{ campaignId: "c1", name: "Hero push", impressions: 1000, clicks: 50, ctr: 5, atcs: 10, units: 8, spend: 4000.4, revenue: 12000.6, roas: 3.0001, status: "strong" }],
  crisisResponses: [{ crisisId: "x", eventId: "e", optionKey: "a", tokenCost: 0, day: 9, crisisNum: 1, score: 10, maxScore: 10, optionLabel: "Pause", title: "Supply alert", bestChoice: true }],
  weekTotals: [{ week: 1, totals: { spend: 1000, impressions: 2000, clicks: 40, atcs: 5, units: 4, revenue: 3000, roas: 3 } }],
  days: [{ day: 1, spend: 100, impressions: 200, clicks: 4, atcs: 1, units: 1, revenue: 300, byCampaign: { c1: { spend: 100, impressions: 200, clicks: 4, atcs: 1, units: 1, revenue: 300 } } }],
  decisionsLog: [{ week: 2, type: "scale", campaignId: "c1", description: "Scaled 25%", tokenCost: 1 }],
  microDecisionsLog: [{ day: 3, decision: "Paused keyword" }],
  daypartingChanges: { c1: { blocks: [2, 3, 4, 5, 6, 7], changedDay: 5 } },
  exportedAt: "2026-10-11T10:00:00.000Z",
};

describe("results workbook", () => {
  const sheets = buildResultsSheets(input);
  const byName = Object.fromEntries(sheets.map((s) => [s.name, s.rows]));

  it("has every sheet the trainer asked for", () => {
    expect(sheets.map((s) => s.name)).toEqual([
      "Summary", "Score lines", "Client goals", "Campaigns", "Crisis decisions", "Weekly totals", "Daily by campaign", "Decisions log",
    ]);
    expect(RESULTS_README.length).toBeGreaterThan(5);
  });

  it("keeps numbers as numbers in the score lines and adds tier and fix text", () => {
    const dp = byName["Score lines"].find((r) => r.Line === "Ad schedule (dayparting)")!;
    expect(dp.Earned).toBe(0);
    expect(dp.Max).toBe(15);
    expect(dp["Points lost"]).toBe(15);
    expect(String(dp["Level reached"])).toMatch(/No schedule change/);
    expect(String(dp["How to improve"])).toMatch(/quiet hours/);
    expect(byName["Score lines"].find((r) => r.Line === "Geography")!["How to improve"]).toBe("");
  });

  it("summary has category totals that add to the grand total", () => {
    const cats = byName.Summary.filter((r) => String(r.Field).endsWith(" score") && r.Field !== "Total score");
    expect(cats).toHaveLength(4);
    expect(cats.reduce((s, r) => s + Number(r.Value), 0)).toBe(85);
  });

  it("lists launched campaigns only, with schedule and results", () => {
    expect(byName.Campaigns).toHaveLength(1);
    const c = byName.Campaigns[0];
    expect(c.States).toBe("Karnataka, Delhi");
    expect(c["Spend (₹)"]).toBe(4000);
    expect(c.ROAS).toBe(3);
    expect(c["Schedule changed on day"]).toBe(5);
  });

  it("orders decisions by week then day and includes schedule changes", () => {
    expect(byName["Decisions log"].map((r) => r.Source)).toEqual(["In-run decision", "Schedule change", "Weekly decision"]);
  });

  it("builds a valid workbook with README first", () => {
    const wb = buildWorkbook(sheets, RESULTS_README);
    expect(wb.SheetNames[0]).toBe("README");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Daily by campaign"]);
    expect(rows[0]["Spend (₹)"]).toBe(100);
  });
});

describe("helpers", () => {
  it("describes schedules", () => {
    expect(scheduleText({})).toBe("All days; All hours");
    expect(scheduleText({ dayparting: [6], scheduleType: "days_of_week", selectedDays: [0, 6] })).toBe("Sun, Sat; 6–9 PM");
  });

  it("builds a dated file name", () => {
    expect(resultsFilename("Ritika", "Henlo", "2026-10-11T10:00:00Z")).toBe("blinkit-sim-results-Ritika-Henlo-2026-10-11.xlsx");
  });
});
