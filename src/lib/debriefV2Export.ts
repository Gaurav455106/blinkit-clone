// ── v2 results workbook (SPEC §7.3.2 "Results-page workbook") ─────────────────
// Score lines, decision moments, costliest mistakes and client goals, then the
// twelve R1–R12 reports for all 30 days. Numbers stay numbers.

import type { SheetSpec } from "@/lib/excel";
import type { ScoreV2 } from "@/market/scoringV2";
import type { MomentScore } from "@/market/moments";
import { buildReportSheets, type ReportInput } from "@/market/reports";
import { SCORE_SCHEMES } from "@/lib/rubrics";

const PART_LABEL = Object.fromEntries(SCORE_SCHEMES[2].map((c) => [c.key, c.label]));

export const VERDICT_LABEL: Readonly<Record<MomentScore["verdict"], string>> = {
  right: "Right move in time",
  partial: "Partly right or late",
  wrong: "Made it worse",
  ignored: "No response in time",
  nothingNeeded: "Nothing needed",
};

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function debriefSheets(score: ScoreV2, reportInput: ReportInput): SheetSpec[] {
  return [
    {
      name: "Score lines",
      rows: score.lines.map((l) => ({
        "Part": PART_LABEL[l.category] ?? l.category,
        "Line": l.label,
        "Points": l.earned,
        "Out of": round1(l.max),
        "Why": l.note,
        "What we looked at": l.judgedOn,
        "How to improve": l.howToImprove,
      })),
    },
    {
      name: "Decision moments",
      rows: score.moments.map((m) => ({
        "Sim day": m.moment.day,
        "What happened": m.moment.title,
        "What the data showed": m.moment.evidence,
        "What you did": m.studentAction ?? "Nothing",
        "Best move": m.bestLever,
        "Verdict": VERDICT_LABEL[m.verdict],
        "Points": round1(m.points),
        "Out of": round1(m.max),
        "Your move gained": round(m.gainVsNothing),
        "Best move would gain": round(m.bestGainVsNothing),
      })),
    },
    {
      name: "Costliest mistakes",
      rows: score.costliestMistakes.map((c, i) => ({ "Rank": i + 1, "Moment": c.title, "What you did": c.what, "Lost vs best move": round(c.lost) })),
    },
    {
      name: "Client goals",
      rows: score.goalRows.map((g) => ({ "Goal": g.label, "Target": g.goal, "Reached": round1(g.actual), "Unit": g.unit, "Achieved (%)": g.pct })),
    },
    ...buildReportSheets(reportInput),
  ];
}

export function debriefFilename(studentName: string, brandName: string): string {
  return `blinkit-results-v2-${studentName}-${brandName}`.replace(/[^\w.-]+/g, "-");
}
