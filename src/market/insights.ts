// ── Insight log: from report to action (SPEC §7.3.1) ──────────────────────────
// At each weekly checkpoint the student records what the reports showed and
// what they'll do. A logged insight earns credit when it names a real decision
// moment (same kind of problem, same subject, within a few days), and more when
// an action on that campaign follows.

import type { Moment, MomentType } from "@/market/moments";
import type { LiveAction } from "@/market/actions";

export type InsightType = MomentType | "stockLow" | "rivalTookSlot" | "noChange" | "other";

export const INSIGHT_TYPES: readonly { type: InsightType; label: string }[] = [
  { type: "belowBreakEven", label: "A keyword is losing money" },
  { type: "sovDrop", label: "I lost visibility on a keyword" },
  { type: "budgetCapPeak", label: "Budget runs out before peak hours" },
  { type: "headTakesMoney", label: "A head keyword is taking the budget" },
  { type: "heroStarved", label: "A low-margin product is eating the budget" },
  { type: "stateStarved", label: "A strong state is rationed" },
  { type: "stockLow", label: "Stock is about to stop my ads" },
  { type: "rivalTookSlot", label: "A rival took my slot" },
  { type: "noChange", label: "No change needed this week" },
  { type: "other", label: "Something else" },
];

export interface Insight {
  day: number;
  type: InsightType;
  /** Keyword, state or SKU it's about. */
  subject: string;
  /** Report and number that shows it, e.g. "R2: ROAS 2.1 vs break-even 3.3". */
  evidence: string;
  plannedAction: string;
}

const MATCH_DAYS = 4;
const ACT_DAYS = 3;
const INSIGHT_CREDIT = 0.6;
const ACTION_CREDIT = 0.4;
/** Credit is measured against up to this many moments. */
const TARGET_MOMENTS = 3;

const norm = (s: string) => s.trim().toLowerCase();

export interface InsightMatch {
  insight: Insight;
  moment: Moment | null;
  acted: boolean;
}

export function matchInsights(insights: readonly Insight[], moments: readonly Moment[], actions: readonly LiveAction[]): InsightMatch[] {
  const used = new Set<string>();
  return insights.map((insight) => {
    const moment = moments.find((m) =>
      !used.has(m.id) && m.type === insight.type && Math.abs(m.day - insight.day) <= MATCH_DAYS &&
      (norm(insight.subject) === "" || norm(m.subject).includes(norm(insight.subject)) || norm(insight.subject).includes(norm(m.subject))));
    if (moment) used.add(moment.id);
    const acted = !!moment && actions.some((a) => a.campaignId === moment.campaignId && a.dayMade >= insight.day && a.dayMade <= insight.day + ACT_DAYS);
    return { insight, moment: moment ?? null, acted };
  });
}

export interface InsightScore {
  earned: number;
  max: number;
  matches: readonly InsightMatch[];
  note: string;
}

export function scoreInsights(insights: readonly Insight[], moments: readonly Moment[], actions: readonly LiveAction[], max: number): InsightScore {
  const matches = matchInsights(insights, moments, actions);
  if (moments.length === 0) {
    const earned = insights.length > 0 ? max : 0;
    return { earned, max, matches, note: insights.length ? "Logged your analysis; no moment needed action." : "No insights logged at the checkpoints." };
  }
  const credit = matches.reduce((s, m) => s + (m.moment ? INSIGHT_CREDIT + (m.acted ? ACTION_CREDIT : 0) : 0), 0);
  const target = Math.min(TARGET_MOMENTS, moments.length);
  const earned = Math.round(max * Math.min(1, credit / target) * 10) / 10;
  const found = matches.filter((m) => m.moment);
  const acted = found.filter((m) => m.acted);
  const note = insights.length === 0
    ? "No insights logged at the checkpoints, so none of the reports turned into a decision."
    : `${found.length} of ${insights.length} logged insights matched a real problem in the data; ${acted.length} were followed by an action within ${ACT_DAYS} days.`;
  return { earned, max, matches, note };
}
