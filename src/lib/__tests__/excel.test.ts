import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildWorkbook, safeSheetName } from "@/lib/excel";

describe("excel export", () => {
  it("keeps sheet names within Excel's rules", () => {
    expect(safeSheetName("Keyword performance: day 1/7 [all]")).toBe("Keyword performance  day 1 7  a");
    expect(safeSheetName("Keyword performance: day 1/7 [all]").length).toBeLessThanOrEqual(31);
    expect(safeSheetName("***")).toBe("Sheet");
  });

  it("adds a README first, keeps numbers as numbers, and de-duplicates names", () => {
    const wb = buildWorkbook(
      [{ name: "Scores", rows: [{ Line: "Geography", Earned: 7, Max: 7 }] }, { name: "Scores", rows: [] }],
      [{ column: "Earned", meaning: "Points awarded" }],
    );
    expect(wb.SheetNames).toEqual(["README", "Scores", "Scores 2"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Scores);
    expect(rows[0].Earned).toBe(7);
    expect(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Scores 2"])[0].Note).toBe("No data");
  });
});
