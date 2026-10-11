// ── Overview panels data: spend by ad format, keyword share of voice ──────────
// v1 showed both on its live dashboard; v2 brings them back with real numbers.

import type { DayResult } from "@/market/engineTypes";
import { byUnit } from "@/market/aggregate";
import { FORMAT_NAMES } from "@/market/formats";

export interface FormatSpend { format: string; label: string; spend: number; share: number }

/** Spend per ad format over the run, largest first. `formatById` maps campaign id → ad format. */
export function spendByFormat(results: readonly DayResult[], formatById: Readonly<Record<string, string | null | undefined>>): FormatSpend[] {
  const spend = new Map<string, number>();
  for (const r of results) for (const c of r.cells) {
    const f = formatById[c.campaignId] ?? "other";
    spend.set(f, (spend.get(f) ?? 0) + c.spend);
  }
  const total = [...spend.values()].reduce((s, x) => s + x, 0);
  if (total <= 0) return [];
  return [...spend.entries()]
    .map(([format, s]) => ({ format, label: FORMAT_NAMES[format] ?? "Other", spend: s, share: s / total }))
    .sort((a, b) => b.spend - a.spend);
}

export interface KeywordSovRow { term: string; searches: number; sov: number; kind: "good" | "risky" | "other" }

const SOV_WINDOW_DAYS = 7;

/** Each keyword's searches and share of ad views (SOV) over the last 7 days, most searched first. */
export function keywordSov(results: readonly DayResult[], good: readonly string[], risky: readonly string[]): KeywordSovRow[] {
  const recent = results.slice(-SOV_WINDOW_DAYS).flatMap((r) => r.cells).filter((c) => c.inventory === "keyword");
  return byUnit(recent)
    .map((u) => ({ term: u.key, searches: u.searches, sov: u.sov, kind: good.includes(u.key) ? "good" as const : risky.includes(u.key) ? "risky" as const : "other" as const }))
    .sort((a, b) => b.searches - a.searches);
}
