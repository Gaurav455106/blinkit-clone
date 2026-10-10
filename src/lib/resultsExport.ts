// ── Results-page Excel workbook (SPEC §7.3) ───────────────────────────────────
// Pure sheet builders over the data already on the results page; the page calls
// downloadWorkbook() with the result. Numbers stay numbers; long format.

import type { Row, SheetSpec } from "@/lib/excel";
import type { SavedCampaign, CrisisResponse, DecisionLogEntry, WeekResultStored, DaypartingChange } from "@/context/SimContext";
import type { EngineDayResult } from "@/lib/dayEngine";
import type { CampaignMetrics } from "@/lib/simResults";
import type { GoalRow } from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES, categoryLabel, lineGuide, lineTier, plainText, type LineResult } from "@/lib/rubrics";
import { HOUR_BLOCK_LABELS } from "@/lib/engine";

export interface ReadmeRow { column: string; meaning: string }

export interface ResultsExportInput {
  student: { name: string; email: string; batch: string };
  brand: string;
  grandTotal: number;
  gradeLabel: string;
  achievementPct: number;
  lines: readonly LineResult[];
  goalRows: readonly GoalRow[];
  campaigns: readonly SavedCampaign[];
  perCampaign: readonly CampaignMetrics[];
  crisisResponses: readonly CrisisResponse[];
  weekTotals: readonly WeekResultStored[];
  days: readonly EngineDayResult[];
  decisionsLog: readonly DecisionLogEntry[];
  microDecisionsLog: readonly { day: number; decision: string }[];
  daypartingChanges: Readonly<Record<string, DaypartingChange>>;
  exportedAt: string;
}

const FORMAT_LABELS: Record<string, string> = {
  product_booster: "Product Booster",
  recommendation_ads: "Recommendation Ads",
  listing_spotlight: "Listing Spotlight",
  brand_booster: "Brand Booster",
  stories: "Stories Ad",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const formatLabel = (f: string | null | undefined): string => (f ? FORMAT_LABELS[f] ?? f : "");

const round2 = (n: number) => Math.round(n * 100) / 100;
const ratio = (a: number, b: number) => (b > 0 ? round2(a / b) : 0);

export function scheduleText(c: Pick<SavedCampaign, "dayparting" | "scheduleType" | "selectedDays">): string {
  const hours = c.dayparting && c.dayparting.length > 0 && c.dayparting.length < HOUR_BLOCK_LABELS.length
    ? c.dayparting.map((b) => HOUR_BLOCK_LABELS[b] ?? `slot ${b}`).join(", ")
    : "All hours";
  const days = c.scheduleType === "days_of_week" && c.selectedDays?.length
    ? c.selectedDays.map((d) => DAY_NAMES[d] ?? `${d}`).join(", ")
    : "All days";
  return `${days}; ${hours}`;
}

/** The plain-words rule behind the points a line earned (its level). */
export const levelReached = (l: LineResult): string => lineTier(l)?.condition ?? "";

function summaryRows(i: ResultsExportInput): Row[] {
  const base: Row[] = [
    { Field: "Student", Value: i.student.name },
    { Field: "Email", Value: i.student.email },
    { Field: "Batch", Value: i.student.batch },
    { Field: "Brand", Value: i.brand },
    { Field: "Total score", Value: i.grandTotal },
    { Field: "Total max", Value: 100 },
    { Field: "Grade", Value: i.gradeLabel },
    { Field: "Client goal achievement (%)", Value: i.achievementPct },
  ];
  const cats: Row[] = SCORE_SCHEMES[1].map((c) => ({
    Field: `${c.label} score`,
    Value: i.lines.filter((l) => l.category === c.key).reduce((s, l) => s + l.earned, 0),
    Max: c.max,
  }));
  return [...base, ...cats, { Field: "Exported at", Value: i.exportedAt }];
}

export function scoreLineRows(lines: readonly LineResult[]): Row[] {
  return lines.map((l) => ({
    Category: categoryLabel(l.category),
    Line: l.label,
    Earned: l.earned,
    Max: l.max,
    "Points lost": l.max - l.earned,
    "Level reached": levelReached(l),
    Reason: plainText(l.note),
    "How to improve": l.earned < l.max ? lineGuide(l).howToImprove : "",
  }));
}

function goalRowsSheet(goals: readonly GoalRow[]): Row[] {
  return goals.map((g) => ({ Goal: g.label, Unit: g.unit, Target: g.goal, Actual: round2(g.actual), "Achieved (%)": g.pct }));
}

function campaignRows(i: ResultsExportInput): Row[] {
  return i.campaigns.filter((c) => !c.isDraft).map((c) => {
    const m = i.perCampaign.find((p) => p.campaignId === c.id);
    return {
      Campaign: c.name,
      Format: formatLabel(c.adFormat),
      Objective: c.objective ?? "",
      "Launch day": c.launchDay ?? 1,
      States: c.geography === "pan_india" ? "Pan India" : c.cities.join(", "),
      SKUs: c.skuIds.join(", "),
      Keywords: c.keywords.join(", "),
      Categories: (c.categories ?? []).join(", "),
      Feeds: (c.feeds ?? []).join(", "),
      "Budget type": c.budgetType ?? "",
      "Budget (₹)": c.budget,
      Schedule: scheduleText(c),
      "Schedule changed on day": i.daypartingChanges[c.id]?.changedDay ?? null,
      "Schedule after change": i.daypartingChanges[c.id] ? scheduleText({ dayparting: i.daypartingChanges[c.id].blocks }) : "",
      "Spend (₹)": m ? Math.round(m.spend) : null,
      Impressions: m?.impressions ?? null,
      Clicks: m?.clicks ?? null,
      Units: m?.units ?? null,
      "Revenue (₹)": m ? Math.round(m.revenue) : null,
      ROAS: m ? round2(m.roas) : null,
      Status: m?.status ?? "",
    };
  });
}

function crisisRows(list: readonly CrisisResponse[]): Row[] {
  return [...list].sort((a, b) => (a.crisisNum ?? 0) - (b.crisisNum ?? 0)).map((c) => ({
    Crisis: c.crisisNum ?? null,
    Day: c.day,
    Title: plainText(c.title ?? ""),
    Option: (c.optionKey ?? "").toUpperCase(),
    "Option chosen": plainText(c.optionLabel ?? ""),
    Effect: plainText(c.effectLabel ?? ""),
    "Option score": c.score ?? 0,
    "Best option score": c.maxScore ?? null,
    "Best choice": !!c.bestChoice,
  }));
}

function weekRows(weeks: readonly WeekResultStored[]): Row[] {
  return weeks.map((w) => ({
    Week: w.week,
    "Spend (₹)": Math.round(w.totals.spend),
    Impressions: w.totals.impressions,
    Clicks: w.totals.clicks,
    "CTR (%)": round2(ratio(w.totals.clicks, w.totals.impressions) * 100),
    ATCs: w.totals.atcs,
    Units: w.totals.units,
    "Revenue (₹)": Math.round(w.totals.revenue),
    ROAS: round2(w.totals.roas),
  }));
}

function dailyRows(days: readonly EngineDayResult[], campaigns: readonly SavedCampaign[]): Row[] {
  const name = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;
  return days.flatMap((d) => Object.entries(d.byCampaign ?? {}).map(([id, m]) => ({
    "Sim day": d.day,
    Campaign: name(id),
    "Spend (₹)": Math.round(m.spend),
    Impressions: m.impressions,
    Clicks: m.clicks,
    "CTR (%)": round2(ratio(m.clicks, m.impressions) * 100),
    ATCs: m.atcs,
    Units: m.units,
    "Revenue (₹)": Math.round(m.revenue),
    ROAS: ratio(m.revenue, m.spend),
  })));
}

function decisionRows(i: ResultsExportInput): Row[] {
  const name = (id?: string) => (id ? i.campaigns.find((c) => c.id === id)?.name ?? id : "");
  const weekly: Row[] = i.decisionsLog.map((d) => ({
    Source: "Weekly decision", Week: d.week, Day: null, Type: d.type, Campaign: name(d.campaignId), Description: plainText(d.description), "Token cost": d.tokenCost,
  }));
  const micro: Row[] = i.microDecisionsLog.map((d) => ({
    Source: "In-run decision", Week: Math.ceil(d.day / 7), Day: d.day, Type: "", Campaign: "", Description: plainText(d.decision), "Token cost": null,
  }));
  const schedule: Row[] = Object.entries(i.daypartingChanges).map(([id, dc]) => ({
    Source: "Schedule change", Week: Math.ceil(dc.changedDay / 7), Day: dc.changedDay, Type: "dayparting", Campaign: name(id),
    Description: `Kept: ${scheduleText({ dayparting: dc.blocks })}`, "Token cost": null,
  }));
  return [...weekly, ...micro, ...schedule].sort((a, b) => Number(a.Week ?? 0) - Number(b.Week ?? 0) || Number(a.Day ?? 0) - Number(b.Day ?? 0));
}

export const RESULTS_README: readonly ReadmeRow[] = [
  { column: "Summary", meaning: "Who played, the brand, the total score out of 100, the grade and the score for each part." },
  { column: "Score lines", meaning: "One row for each thing you were scored on. Earned and Max are points. Level reached is the rule that gave you those points. Reason explains your result." },
  { column: "Client goals", meaning: "Each goal from the brief: the target, what you reached, and the % reached. In scoring, each goal counts up to 150%." },
  { column: "Campaigns", meaning: "One row for each campaign: format, objective, states, products (SKUs), keywords, budget, ad schedule and its 30-day results." },
  { column: "Crisis decisions", meaning: "Each crisis: the option you chose, its score and the best option's score. In the final score these become 8, 9 and 8 points." },
  { column: "Weekly totals", meaning: "Totals for each week of the run." },
  { column: "Daily by campaign", meaning: "One row for each campaign on each day, from the same run you watched on the live dashboard." },
  { column: "Decisions log", meaning: "Your weekly decisions, decisions during the run and schedule changes, in the order you made them." },
  { column: "CTR (%)", meaning: "Click-through rate: clicks divided by impressions (times the ad was shown), times 100." },
  { column: "ROAS", meaning: "Sales per ₹1 of ads: revenue divided by spend. A ROAS of 3 means ₹3 of sales for every ₹1 spent." },
  { column: "ATCs", meaning: "Add-to-carts: how many times a shopper added the product to their cart." },
  { column: "Spend (₹), Revenue (₹)", meaning: "Rupees, rounded to the nearest rupee." },
];

export function buildResultsSheets(i: ResultsExportInput): SheetSpec[] {
  return [
    { name: "Summary", rows: summaryRows(i) },
    { name: "Score lines", rows: scoreLineRows(i.lines) },
    { name: "Client goals", rows: goalRowsSheet(i.goalRows) },
    { name: "Campaigns", rows: campaignRows(i) },
    { name: "Crisis decisions", rows: crisisRows(i.crisisResponses) },
    { name: "Weekly totals", rows: weekRows(i.weekTotals) },
    { name: "Daily by campaign", rows: dailyRows(i.days, i.campaigns) },
    { name: "Decisions log", rows: decisionRows(i) },
  ];
}

export function resultsFilename(studentName: string, brand: string, isoDate: string): string {
  return `blinkit-sim-results-${studentName}-${brand}-${isoDate.slice(0, 10)}.xlsx`;
}
