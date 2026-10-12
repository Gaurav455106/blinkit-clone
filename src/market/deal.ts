// ── The opening deal with Rohit (SPEC §6.1, v2 only) ─────────────────────────
// Pure data and mapping. The student splits each SKU's stock pool across the
// states Rohit serves for the brand, asks for up to two things and offers
// commitments in return. The agreed deal becomes engine inputs: day-1 stock,
// Adjustments (stock arriving, shelf boost, funded discount) and tracked
// Commitments. Walking away keeps the brief's stock and adds nothing.

import { BLINKIT_STATES } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import { initialMarketState } from "@/market/state";
import { EMPTY_ADJUSTMENTS, type Adjustments, type StockAdd } from "@/market/adjustments";
import type { Commitment } from "@/market/rohit";
import { formatRupees } from "@/lib/money";

/** Units per SKU per state. */
export type StockSplit = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type DealAsk =
  | { kind: "moreStores"; state: string }
  | { kind: "shelfSpot" }
  | { kind: "fastRestock"; state: string };

export type DealGive =
  | { kind: "adSpend"; perDay: number; days: number }
  | { kind: "discount"; skuIds: readonly string[]; pct: number }
  | { kind: "supply"; state: string; osaPct: number; byDay: number };

export interface DealTerms {
  stock: StockSplit;
  asks: readonly DealAsk[];
  gives: readonly DealGive[];
  walkedAway: boolean;
}

export interface DealRun {
  startStock: StockSplit;
  adjustments: Adjustments;
  commitments: readonly Commitment[];
}

// ── Tunables ─────────────────────────────────────────────────────────────────

export const MAX_ASKS = 2;
/** "More stores": extra day-1 units in the state, as a share of what the student placed there. */
export const MORE_STORES_SHARE = 0.3;
export const SHELF_BOOST = 1.1;
export const SHELF_DAYS = 10;
/** Expedited restock arrives on this day with this share of the state's day-1 units. */
export const FAST_RESTOCK_DAY = 8;
export const FAST_RESTOCK_SHARE = 0.4;
export const DISCOUNT_DAYS = 7;
const DEAL_KEPT = 8;
const DEAL_BROKEN = -12;

const inr = formatRupees;
const sum = (m: Readonly<Record<string, number>>) => Object.values(m).reduce((s, x) => s + x, 0);

// ── Pool and defaults ────────────────────────────────────────────────────────

/** States Rohit can serve for this brand: its primary and secondary states. */
export function allowedStates(ctx: MarketContext): readonly string[] {
  const p = ctx.scenario.profile;
  return [p.primaryState, ...p.secondaryStates];
}

/** The brief's starting stock, per SKU per state (what walking away keeps). */
export function briefStock(ctx: MarketContext): StockSplit {
  return initialMarketState({ ...ctx, startStock: undefined }).stock;
}

/** Each SKU's pool: the brief's starting units across all states. */
export function stockPool(ctx: MarketContext): Readonly<Record<string, number>> {
  return Object.fromEntries(Object.entries(briefStock(ctx)).map(([sku, byState]) => [sku, sum(byState)]));
}

/** A starting deal sheet: the brief's split, nothing asked, nothing given. */
export function defaultDeal(ctx: MarketContext): DealTerms {
  return { stock: briefStock(ctx), asks: [], gives: [], walkedAway: false };
}

export function walkAwayDeal(ctx: MarketContext): DealTerms {
  return { ...defaultDeal(ctx), walkedAway: true };
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Plain-language problems with a deal sheet; empty when it can be sent. */
export function validateDeal(ctx: MarketContext, d: DealTerms): string[] {
  const allowed = new Set(allowedStates(ctx));
  const pool = stockPool(ctx);
  const names = new Map(ctx.scenario.profile.skus.map((s) => [s.id, s.name]));
  const problems: string[] = [];
  for (const [sku, byState] of Object.entries(d.stock)) {
    const name = names.get(sku) ?? sku;
    for (const [state, units] of Object.entries(byState)) {
      if (units < 0) problems.push(`${name} in ${state} is below zero.`);
      if (units > 0 && !allowed.has(state)) problems.push(`Rohit can't stock ${name} in ${state}. Pick from ${[...allowed].join(", ")}.`);
    }
    if (sum(byState) > (pool[sku] ?? 0) + 1e-6) problems.push(`${name}: you placed more than the ${Math.round(pool[sku] ?? 0).toLocaleString("en-IN")} units you have.`);
  }
  if (d.asks.length > MAX_ASKS) problems.push(`Pick at most two asks.`);
  const giveKinds = d.gives.map((g) => g.kind);
  if (new Set(giveKinds).size !== giveKinds.length) problems.push(`Each kind of offer can be made once.`);
  for (const a of d.asks) if ("state" in a && !allowed.has(a.state)) problems.push(`Rohit doesn't serve ${a.state} for this brand.`);
  return problems;
}

// ── Deal → engine inputs ─────────────────────────────────────────────────────

/** Every Blinkit state present (0 where nothing was placed), so the engine sees the whole map. */
function fullSplit(ctx: MarketContext, stock: StockSplit): StockSplit {
  return Object.fromEntries(ctx.scenario.profile.skus.map((sku) => [
    sku.id,
    Object.fromEntries(BLINKIT_STATES.map((s) => [s, Math.max(0, stock[sku.id]?.[s] ?? 0)])),
  ]));
}

function stateAdds(stock: StockSplit, state: string, share: number, day: number): StockAdd[] {
  return Object.entries(stock)
    .map(([skuId, byState]) => ({ day, state, skuId, units: Math.round((byState[state] ?? 0) * share) }))
    .filter((a) => a.units > 0);
}

function askAdjustments(stock: StockSplit, asks: readonly DealAsk[]): Adjustments {
  return asks.reduce<Adjustments>((acc, a) => {
    switch (a.kind) {
      case "moreStores": return { ...acc, stockAdds: [...acc.stockAdds, ...stateAdds(stock, a.state, MORE_STORES_SHARE, 1)] };
      case "fastRestock": return { ...acc, stockAdds: [...acc.stockAdds, ...stateAdds(stock, a.state, FAST_RESTOCK_SHARE, FAST_RESTOCK_DAY)] };
      case "shelfSpot": return { ...acc, shelfBoosts: [...acc.shelfBoosts, { fromDay: 1, toDay: SHELF_DAYS, relevanceMult: SHELF_BOOST }] };
    }
  }, EMPTY_ADJUSTMENTS);
}

function discountCuts(ctx: MarketContext, gives: readonly DealGive[]): Adjustments["priceCuts"] {
  const mrp = new Map(ctx.scenario.profile.skus.map((s) => [s.id, s.mrp]));
  return gives.flatMap((g) => g.kind !== "discount" ? [] : [{
    fromDay: 1, toDay: DISCOUNT_DAYS, skuIds: g.skuIds, pct: g.pct,
    marginPerUnit: Object.fromEntries(g.skuIds.map((id) => [id, Math.round((mrp.get(id) ?? 0) * g.pct)])),
  }]);
}

function promise(g: DealGive): Commitment | null {
  const base = { askId: "opening_deal" as const, fromDay: 1, keptDelta: DEAL_KEPT, brokenDelta: DEAL_BROKEN };
  if (g.kind === "adSpend") {
    const target = g.perDay * g.days;
    return { ...base, id: `opening_deal:adSpend`, kind: "spend_at_least", target, dueDay: g.days, text: `Spend at least ${inr(target)} on ads by day ${g.days}` };
  }
  if (g.kind === "supply") {
    return { ...base, id: `opening_deal:supply:${g.state}`, kind: "osa_at_least", target: g.osaPct / 100, dueDay: g.byDay, state: g.state, text: `Keep at least ${g.osaPct}% of stores in ${g.state} stocked on day ${g.byDay}` };
  }
  return null;
}

/** The engine inputs for an agreed deal. A walk-away keeps the brief and adds nothing. */
export function dealToRun(ctx: MarketContext, d: DealTerms): DealRun {
  if (d.walkedAway) return { startStock: fullSplit(ctx, briefStock(ctx)), adjustments: EMPTY_ADJUSTMENTS, commitments: [] };
  const stock = fullSplit(ctx, d.stock);
  const asks = askAdjustments(stock, d.asks);
  return {
    startStock: stock,
    adjustments: { ...asks, priceCuts: discountCuts(ctx, d.gives) },
    commitments: d.gives.map(promise).filter((c): c is Commitment => c !== null),
  };
}

/** A context whose day-1 stock is the deal's split. */
export function withStartStock(ctx: MarketContext, startStock: StockSplit): MarketContext {
  return { ...ctx, startStock };
}

// ── The agreed deal, as stored with the student's session ──────────────────

export interface OpeningDeal {
  terms: DealTerms;
  /** Where Rohit's relationship meter starts (30 to 80; 50 after a walk-away). */
  relationship: number;
  /** The conversation, for the debrief. */
  log: readonly { speaker: "rohit" | "student"; text: string }[];
}
