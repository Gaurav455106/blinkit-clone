// ── Run adjustments: what Rohit's replies change in the market (SPEC §6) ──────
// A reply is chosen after day D has run, so its effects start on day D + 1 at
// the earliest. Effects are stored as data and handed to stepDay, so a replay
// of the run gives exactly the same days.
//
// Covered here: stock arriving (restock, new dark-store cluster), fees paid
// (counted against the ₹2 lakh budget), a funded discount (lower price and
// margin on named SKUs) and a shelf boost (higher relevance). Dropping states
// and promised budgets are campaign changes and commitments, handled by the
// dashboard as live actions.

import type { ReplyEffect } from "@/market/rohit";

export interface StockAdd { day: number; state: string; skuId: string; units: number }
export interface ExtraSpend { day: number; amount: number }
export interface PriceCut { fromDay: number; toDay: number; skuIds: readonly string[]; pct: number; marginPerUnit: Readonly<Record<string, number>> }
export interface ShelfBoost { fromDay: number; toDay: number; relevanceMult: number }

export interface Adjustments {
  stockAdds: readonly StockAdd[];
  extraSpend: readonly ExtraSpend[];
  priceCuts: readonly PriceCut[];
  shelfBoosts: readonly ShelfBoost[];
}

export const EMPTY_ADJUSTMENTS: Adjustments = { stockAdds: [], extraSpend: [], priceCuts: [], shelfBoosts: [] };

const unitsToAdds = (day: number, state: string, units: Readonly<Record<string, number>>): StockAdd[] =>
  Object.entries(units).filter(([, n]) => n > 0).map(([skuId, n]) => ({ day, state, skuId, units: n }));

/** The engine effects of one reply chosen after `lastCompletedDay`. */
export function adjustmentsFromReply(effect: ReplyEffect, lastCompletedDay: number): Adjustments {
  const next = lastCompletedDay + 1;
  const stockAdds = [
    ...(effect.restock ? unitsToAdds(Math.max(next, lastCompletedDay + effect.restock.afterDays), effect.restock.state, effect.restock.units) : []),
    ...(effect.addStock ? unitsToAdds(Math.max(next, effect.addStock.fromDay), effect.addStock.state, effect.addStock.units) : []),
  ];
  return {
    stockAdds,
    extraSpend: effect.cost && effect.cost > 0 ? [{ day: next, amount: effect.cost }] : [],
    priceCuts: effect.discount
      ? [{ fromDay: next, toDay: next + effect.discount.days - 1, skuIds: effect.discount.skuIds, pct: effect.discount.pct, marginPerUnit: effect.discount.marginPerUnit }]
      : [],
    shelfBoosts: effect.shelfBoost
      ? [{ fromDay: next, toDay: next + effect.shelfBoost.days - 1, relevanceMult: effect.shelfBoost.relevanceMult }]
      : [],
  };
}

export function mergeAdjustments(a: Adjustments, b: Adjustments): Adjustments {
  return {
    stockAdds: [...a.stockAdds, ...b.stockAdds],
    extraSpend: [...a.extraSpend, ...b.extraSpend],
    priceCuts: [...a.priceCuts, ...b.priceCuts],
    shelfBoosts: [...a.shelfBoosts, ...b.shelfBoosts],
  };
}

const within = (x: { fromDay: number; toDay: number }, day: number) => day >= x.fromDay && day <= x.toDay;

export function stockAddsOn(adj: Adjustments, day: number): readonly StockAdd[] {
  return adj.stockAdds.filter((s) => s.day === day);
}

export function extraSpendOn(adj: Adjustments, day: number): number {
  return adj.extraSpend.filter((s) => s.day === day).reduce((t, s) => t + s.amount, 0);
}

/** Price cut and margin given up per unit for a SKU today (deepest cut wins). */
export function priceCutFor(adj: Adjustments, day: number, skuId: string): { pct: number; marginGivenUp: number } {
  const cuts = adj.priceCuts.filter((c) => within(c, day) && c.skuIds.includes(skuId));
  if (cuts.length === 0) return { pct: 0, marginGivenUp: 0 };
  const deepest = cuts.reduce((a, b) => (b.pct > a.pct ? b : a));
  return { pct: deepest.pct, marginGivenUp: deepest.marginPerUnit[skuId] ?? 0 };
}

export function shelfMult(adj: Adjustments, day: number): number {
  return adj.shelfBoosts.filter((b) => within(b, day)).reduce((p, b) => p * b.relevanceMult, 1);
}
