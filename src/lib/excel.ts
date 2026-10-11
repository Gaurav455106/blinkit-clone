// ── Excel export (SPEC §7.3): build .xlsx workbooks in the browser ────────────
// Long-format sheets (one row per entity) so pivot tables work; numbers stay
// numbers. A README sheet explains every column.

import * as XLSX from "xlsx";

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export interface SheetSpec {
  /** Excel sheet names: max 31 characters, no []:*?/\ */
  name: string;
  rows: readonly Row[];
}

const INVALID_SHEET_CHARS = /[[\]:*?/\\]/g;
const MAX_SHEET_NAME = 31;

export function safeSheetName(name: string): string {
  return name.replace(INVALID_SHEET_CHARS, " ").slice(0, MAX_SHEET_NAME).trim() || "Sheet";
}

/** Build a workbook (exported for tests). Empty sheets get a single "No data" row. */
export function buildWorkbook(sheets: readonly SheetSpec[], readme?: readonly { column: string; meaning: string }[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  if (readme && readme.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme.map((r) => ({ Column: r.column, Meaning: r.meaning }))), "README");
  }
  const used = new Set<string>();
  for (const sheet of sheets) {
    let name = safeSheetName(sheet.name);
    for (let i = 2; used.has(name); i++) name = safeSheetName(`${sheet.name} ${i}`);
    used.add(name);
    const rows = sheet.rows.length ? sheet.rows : [{ Note: "No data" }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows as Row[]), name);
  }
  return wb;
}

export function downloadWorkbook(filename: string, sheets: readonly SheetSpec[], readme?: readonly { column: string; meaning: string }[]): void {
  const safe = filename.replace(/[^\w.-]+/g, "-");
  XLSX.writeFile(buildWorkbook(sheets, readme), safe.endsWith(".xlsx") ? safe : `${safe}.xlsx`);
}
