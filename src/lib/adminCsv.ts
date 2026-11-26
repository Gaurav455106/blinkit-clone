// Admin CSV export of best-run-per-student rows (the cohort tab also exports a full Excel file).

import { attemptCampaigns, attemptTotals, brandOf, type AttemptRow } from "@/lib/attemptAnalysis";
import { formatLabel } from "@/lib/resultsExport";

const HEADERS = [
  "Name", "Email", "Batch", "Brand", "Score",
  "Setup", "Live Opt", "Crisis", "Results",
  "Crisis Choice", "Crisis Points",
  "Campaign Formats", "Total Campaigns",
];

const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function attemptsToCsv(rows: readonly AttemptRow[]): string {
  const body = rows.map((r) => {
    const t = attemptTotals(r);
    const campaigns = attemptCampaigns(r);
    return [
      r.name, r.email, r.batch_code, brandOf(r), r.score_total,
      t?.setup ?? "", t?.liveOpt ?? t?.live ?? "", t?.crisis ?? t?.eventsRohit ?? "", t?.results ?? "",
      r.crisis_choice ?? "", r.crisis_points ?? 0,
      campaigns.map((c) => formatLabel(c.adFormat)).join("; "), campaigns.length,
    ].map(escape).join(",");
  });
  return [HEADERS.map(escape).join(","), ...body].join("\n");
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
