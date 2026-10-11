import { describe, it, expect } from "vitest";
import { runHeadless } from "@/market/headless";
import { REPORTS, buildReportSheets, type ReportInput } from "@/market/reports";
import { recordAction, type LiveAction } from "@/market/actions";
import { sumMetrics } from "@/market/aggregate";
import type { CampaignConfig } from "@/market/engineTypes";
import { buildWorkbook } from "@/lib/excel";
import { testContext } from "./testContext";

const ctx = testContext("fuelup");
const campaigns: CampaignConfig[] = [{
  id: "c1", skuIds: ["fuel-1", "fuel-3"],
  keywords: [{ term: "whey protein", exactBid: 500, smartBid: 380 }, { term: "protein bar", exactBid: 450 }],
  placements: [{ id: "category:Sports Nutrition", bid: 450 }, { id: "stories:main-feed", bid: 500 }],
  geography: "pan_india", cities: [], budgetType: "daily", budget: 5000, launchDay: 1,
}];
const run = runHeadless(ctx, () => campaigns, 5);
const action: LiveAction = { campaignId: "c1", dayMade: 2, change: { kind: "budget", budget: 6000 } };
const input: ReportInput = {
  ctx, results: run.results, configsByDay: run.results.map(() => campaigns),
  campaignNames: { c1: "Whey push" }, changeLog: [recordAction(campaigns, action)], startDate: "2026-11-02",
};

describe("Excel reports R1–R12 (SPEC §7.3)", () => {
  it("defines all 12 reports", () => {
    expect(REPORTS.map((r) => r.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12"]);
  });

  it("R1 campaign spend per day matches the engine, with ISO dates and sim days", () => {
    const rows = REPORTS[0].build(input);
    expect(rows).toHaveLength(5);
    expect(rows[0]["Date"]).toBe("2026-11-02");
    expect(rows[4]["Sim day"]).toBe(5);
    expect(rows[0]["Spend (₹)"]).toBe(Math.round(sumMetrics(run.results[0].cells).spend));
    expect(rows[0]["Campaign"]).toBe("Whey push");
  });

  it("R2 includes max profitable CPM and category CTR; R12 lists smart-match search terms", () => {
    const r2 = REPORTS[1].build(input);
    expect(r2.some((r) => r["Keyword / placement"] === "whey protein" && typeof r["Max profitable CPM (₹)"] === "number")).toBe(true);
    const r12 = REPORTS[11].build(input);
    expect(r12.every((r) => r["Search term"] !== "whey protein")).toBe(true);
  });

  it("R7 never contains bids, R11 carries the change log", () => {
    const r7 = REPORTS[6].build(input);
    expect(r7.length).toBeGreaterThan(0);
    for (const row of r7) expect(Object.keys(row).some((k) => /bid/i.test(k))).toBe(false);
    expect(REPORTS[10].build(input)[0]).toMatchObject({ "Day made": 2, "Day applied": 3, "What changed": "Budget" });
  });

  it("keeps money and counts as numbers", () => {
    for (const r of REPORTS[0].build(input)) {
      expect(typeof r["Spend (₹)"]).toBe("number");
      expect(typeof r["ROAS"]).toBe("number");
    }
  });

  it("builds a workbook with every report as a sheet", () => {
    const wb = buildWorkbook(buildReportSheets(input));
    expect(wb.SheetNames).toHaveLength(13);
    expect(wb.SheetNames[0]).toBe("How to read this");
    expect(wb.SheetNames[1]).toBe("R1 Campaign performance");
  });

  it("only includes the days it is given (no future data)", () => {
    const partial = { ...input, results: run.results.slice(0, 2) };
    expect(Math.max(...REPORTS[0].build(partial).map((r) => r["Sim day"] as number))).toBe(2);
  });
});
