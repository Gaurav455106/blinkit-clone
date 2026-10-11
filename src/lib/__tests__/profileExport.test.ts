import { describe, it, expect } from "vitest";
import { buildProfileSheets, buildCohortSheets, PROFILE_README, COHORT_README } from "@/lib/profileExport";
import { buildWorkbook } from "@/lib/excel";
import { RUBRICS, type LineResult } from "@/lib/rubrics";
import type { AttemptRow } from "@/lib/attemptAnalysis";

function lines(dayparting: number): LineResult[] {
  return RUBRICS.map((r) => ({ key: r.key, label: r.label, category: r.category, earned: r.key === "dayparting" ? dayparting : r.max, max: r.max, note: r.key === "dayparting" ? "Ran 24/7." : "ok" }));
}

const withLines: AttemptRow = {
  id: "1", name: "Kabir Rao", email: "kabir@x.com", batch_code: "B3", profile_id: "henlo", score_total: 85,
  score_breakdown: { version: 1, setup: 35, liveOpt: 10, crisis: 25, results: 15, lines: lines(0), gradeLabel: "Sharp Strategist" },
  created_at: "2026-10-09T09:00:00Z",
  snapshot: { scenario: { profile: { name: "Henlo" } }, crisisResponses: { a: { crisisNum: 1, optionKey: "a", optionLabel: "Pause", score: 10, maxScore: 10 } } },
};
const legacy: AttemptRow = {
  id: "0", name: "Kabir Rao", email: "kabir@x.com", batch_code: "B3", profile_id: "henlo", score_total: 61,
  score_breakdown: { setup: 25, liveOpt: 8, crisis: 16, results: 12 }, created_at: "2026-09-01T09:00:00Z",
};

describe("profile workbook", () => {
  const sheets = buildProfileSheets([withLines, legacy]);
  const byName = Object.fromEntries(sheets.map((s) => [s.name, s.rows]));

  it("lists attempts oldest first with category totals as numbers", () => {
    expect(byName.Attempts.map((r) => r.Total)).toEqual([61, 85]);
    expect(byName.Attempts[0].Setup).toBe(25);
    expect(byName.Attempts[0]["Line detail saved"]).toBe(false);
    expect(byName.Attempts[1].Grade).toBe("Sharp Strategist");
  });

  it("has score lines only for attempts with line detail", () => {
    expect(byName["Score lines"]).toHaveLength(11);
  });

  it("lists dayparting as a gap", () => {
    const gap = byName["Strengths & gaps"].find((r) => r.Type === "Gap")!;
    expect(gap.Line).toBe("Ad schedule (dayparting)");
    expect(gap["Average points lost"]).toBe(15);
  });

  it("builds with a README", () => {
    expect(buildWorkbook(sheets, PROFILE_README).SheetNames).toEqual(["README", "Attempts", "Score lines", "Strengths & gaps"]);
  });
});

describe("cohort workbook", () => {
  const sheets = buildCohortSheets([withLines, legacy]);
  const byName = Object.fromEntries(sheets.map((s) => [s.name, s.rows]));

  it("has one row per attempt with every line's points and notes", () => {
    expect(byName.Attempts).toHaveLength(2);
    const row = byName.Attempts[1];
    expect(row["Ad schedule (dayparting) (pts)"]).toBe(0);
    expect(row["Ad schedule (dayparting) reason"]).toBe("Ran 24/7.");
    expect(byName.Attempts[0]["Ad schedule (dayparting) (pts)"]).toBeNull();
  });

  it("summarises each line and crisis choice", () => {
    expect(byName["Line summary"]).toHaveLength(11);
    const dp = byName["Line summary"].find((r) => r.Line === "Ad schedule (dayparting)")!;
    expect(dp["Lost points (%)"]).toBe(100);
    expect(byName["Crisis choices"][0]).toMatchObject({ Crisis: 1, Option: "A", Runs: 1, "Average points": 8 });
    expect(COHORT_README.length).toBeGreaterThan(2);
  });
});
