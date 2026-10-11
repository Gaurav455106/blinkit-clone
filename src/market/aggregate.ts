// ── Aggregations for the live dashboard, graphs and reports (SPEC §3.6, §7, §14 F8) ──

import type { CellRow, DayResult } from "@/market/engineTypes";
import type { InventoryKind } from "@/market/types";

export interface Metrics {
  searches: number;
  lostToStock: number;
  lostToBudget: number;
  lostToRank: number;
  won: number;
  viewableImpressions: number;
  totalAdViewable: number;
  spend: number;
  clicks: number;
  atcs: number;
  units: number;
  directRevenue: number;
  indirectRevenue: number;
  revenue: number;
  contribution: number;
  profit: number;
  impressionShare: number;
  sov: number;
  cpm: number;
  ctr: number;
  cvr: number;
  roas: number;
  breakEvenRoas: number;
  /** Realised: contribution per 1,000 viewable impressions (F4 with the student's own data). */
  maxProfitableCpm: number;
  /** 1-based, weighted by viewable impressions; 0 when nothing was shown. */
  avgPosition: number;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export function sumMetrics(cells: readonly CellRow[]): Metrics {
  let searches = 0, lostToStock = 0, lostToBudget = 0, lostToRank = 0, won = 0;
  let vi = 0, totalAdViewable = 0, spend = 0, clicks = 0, atcs = 0, units = 0;
  let directRevenue = 0, indirectRevenue = 0, contribution = 0, positionWeight = 0;
  for (const c of cells) {
    searches += c.searches;
    lostToStock += c.lostToStock;
    lostToBudget += c.lostToBudget;
    lostToRank += c.lostToRank;
    won += c.won;
    vi += c.viewableImpressions;
    totalAdViewable += c.totalAdViewable;
    spend += c.spend;
    clicks += c.clicks;
    atcs += c.atcs;
    units += c.units;
    directRevenue += c.directRevenue;
    indirectRevenue += c.indirectRevenue;
    contribution += c.contribution;
    if (c.position !== null) positionWeight += (c.position + 1) * c.viewableImpressions;
  }
  const revenue = directRevenue + indirectRevenue;
  return {
    searches, lostToStock, lostToBudget, lostToRank, won,
    viewableImpressions: vi, totalAdViewable, spend, clicks, atcs, units,
    directRevenue, indirectRevenue, revenue, contribution,
    profit: contribution - spend,
    impressionShare: ratio(won, searches),
    sov: ratio(vi, totalAdViewable),
    cpm: ratio(spend, vi) * 1000,
    ctr: ratio(clicks, vi),
    cvr: ratio(atcs, clicks),
    roas: ratio(revenue, spend),
    breakEvenRoas: ratio(revenue, contribution),
    maxProfitableCpm: ratio(contribution, vi) * 1000,
    avgPosition: ratio(positionWeight, vi),
  };
}

export interface GroupRow extends Metrics {
  key: string;
}

function groupBy(cells: readonly CellRow[], keyOf: (c: CellRow) => string): GroupRow[] {
  const groups = new Map<string, CellRow[]>();
  for (const c of cells) {
    const k = keyOf(c);
    const list = groups.get(k);
    if (list) list.push(c);
    else groups.set(k, [c]);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, ...sumMetrics(list) }));
}

export interface UnitRow extends GroupRow {
  inventory: InventoryKind;
}

/** By keyword or placement (key = term or placement id). */
export function byUnit(cells: readonly CellRow[]): UnitRow[] {
  const kinds = new Map(cells.map((c) => [c.term, c.inventory] as const));
  return groupBy(cells, (c) => c.term).map((g) => ({ ...g, inventory: kinds.get(g.key) ?? "keyword" }));
}

export const byState = (cells: readonly CellRow[]) => groupBy(cells, (c) => c.state);
export const bySlot = (cells: readonly CellRow[]) => groupBy(cells, (c) => String(c.slot));
export const bySku = (cells: readonly CellRow[]) => groupBy(cells, (c) => c.skuId);
export const byCampaign = (cells: readonly CellRow[]) => groupBy(cells, (c) => c.campaignId);

export const dayTotals = (result: DayResult): Metrics => sumMetrics(result.cells);

export interface RivalInsight {
  /** "you" for the student, otherwise the rival id. */
  rivalId: string;
  viewableImpressions: number;
  /** Share of all ad views on this keyword or placement. */
  sov: number;
  /** Share of its appearances that were in slot 1. */
  topSlotRate: number;
}

/** Auction insights for one keyword or placement over the given days. Never includes bids.
 *  Rivals run in every state, the student only in targeted ones, so only shares of ad
 *  views (SOV) and top-slot rates are comparable; impression share isn't shown for rivals. */
export function rivalInsights(results: readonly DayResult[], term: string): RivalInsight[] {
  const rivalRows = results.flatMap((r) => r.rivals.filter((x) => x.term === term));
  const studentCells = results.flatMap((r) => r.cells.filter((c) => c.term === term));
  const studentViews = studentCells.reduce((s, c) => s + c.viewableImpressions, 0);
  const studentWon = studentCells.reduce((s, c) => s + c.won, 0);
  const studentTop = studentCells.reduce((s, c) => s + (c.position === 0 ? c.won : 0), 0);

  const byRival = new Map<string, { vi: number; top: number; appearances: number }>();
  for (const row of rivalRows) {
    const acc = byRival.get(row.rivalId) ?? { vi: 0, top: 0, appearances: 0 };
    byRival.set(row.rivalId, { vi: acc.vi + row.viewableImpressions, top: acc.top + row.topSlotWins, appearances: acc.appearances + row.appearances });
  }
  const totalViews = [...byRival.values()].reduce((s, a) => s + a.vi, 0) + studentViews;
  const rows: RivalInsight[] = [...byRival.entries()].map(([rivalId, a]) => ({
    rivalId,
    viewableImpressions: a.vi,
    sov: ratio(a.vi, totalViews),
    topSlotRate: ratio(a.top, a.appearances),
  }));
  rows.push({ rivalId: "you", viewableImpressions: studentViews, sov: ratio(studentViews, totalViews), topSlotRate: ratio(studentTop, studentWon) });
  return rows.sort((a, b) => b.sov - a.sov);
}
