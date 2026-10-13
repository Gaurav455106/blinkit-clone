// ── Rohit's side of the opening deal (SPEC §6.1, step 2) ─────────────────────
// Pure and deterministic. Rohit values what the student asks for (stores,
// busy-store space, restocks cost him) against what they offer (ad spend, a funded
// discount, a supply promise), using the brief's own numbers. He raises each
// objection the data supports once, counters at most MAX_COUNTERS times, then
// makes a final offer. The student can always walk away (brief terms).

import type { MarketContext } from "@/market/engineTypes";
import { stateShares } from "@/market/demand";
import type { DataChip } from "@/market/rohit";
import { COFUND_BANNER_COST, EXPEDITE_FEE_PER_UNIT, MIN_EXPEDITE_FEE } from "@/market/rohit";
import { inr, pct } from "@/market/events";
import {
  allowedStates, FAST_RESTOCK_SHARE, MORE_STORES_SHARE, walkAwayDeal,
  type DealAsk, type DealGive, type DealTerms, type StockSplit,
} from "@/market/deal";

// ── Tunables ─────────────────────────────────────────────────────────────────

export const MAX_COUNTERS = 2;
/** Shelf space value Rohit gives up, per ₹ of stock he adds, before the demand factor. */
const SHELF_COST_RATE = 0.2;
/** Space in the busiest dark stores, per ₹ of stock placed in the state, before the demand factor. */
const BUSY_STORES_COST_RATE = 0.05;
/** Rohit discounts promised ad spend: a promise isn't money yet. */
const PROMISE_CREDIT = 0.6;
/** Extra shoppers a discount brings to his shelf, per ₹ of discount. */
const DISCOUNT_TRAFFIC = 3;
const DISCOUNT_DAYS_VALUED = 7;
const SUPPLY_PROMISE_VALUE = 6000;
const SPLIT_GAP = 0.25;
const UNPROVEN_SHARE = 0.2;
const DISCOUNT_MARGIN_SHARE = 0.5;
const OVERPROMISE_SHARE = 0.6;
const LOWER_SPEND_SHARE = 0.4;
const ADD_SPEND_DAYS = 14;
const SPEND_STEP = 500;
const BASE_RELATIONSHIP = 50;

// ── Data Rohit reads ─────────────────────────────────────────────────────────

/** Each allowed state's share of the brand's searches across the allowed states (sums to 1). */
export function demandShares(ctx: MarketContext): Readonly<Record<string, number>> {
  const shares = stateShares(ctx.market);
  const states = allowedStates(ctx);
  const total = states.reduce((s, st) => s + (shares[st] ?? 0), 0);
  return Object.fromEntries(states.map((st) => [st, total > 0 ? (shares[st] ?? 0) / total : 1 / states.length]));
}

const skuById = (ctx: MarketContext) => new Map(ctx.scenario.profile.skus.map((s) => [s.id, s]));
const unitsIn = (row: Readonly<Record<string, number>> | undefined) => Object.values(row ?? {}).reduce((s, x) => s + Math.max(0, x), 0);

/** How well stock follows demand, 0 to 1, weighted by stock value. SKUs with no stock placed don't count. */
export function stockFit(ctx: MarketContext, d: DealTerms): number {
  const shares = demandShares(ctx);
  const skus = skuById(ctx);
  let weighted = 0, weight = 0;
  for (const [id, row] of Object.entries(d.stock)) {
    const units = unitsIn(row);
    if (units <= 0) continue;
    const gap = Object.keys(shares).reduce((s, st) => s + Math.abs((row[st] ?? 0) / units - shares[st]), 0);
    const w = units * (skus.get(id)?.mrp ?? 0);
    weighted += (1 - gap / 2) * w;
    weight += w;
  }
  return weight > 0 ? weighted / weight : 0;
}

// ── Valuation (₹ over the run) ───────────────────────────────────────────────

const stockValueIn = (ctx: MarketContext, d: DealTerms, state: string) => {
  const skus = skuById(ctx);
  return Object.entries(d.stock).reduce((s, [id, row]) => s + (row[state] ?? 0) * (skus.get(id)?.mrp ?? 0), 0);
};

/** A state's share of searches against the average state (0.5 to 3). */
function demandFactor(ctx: MarketContext, state: string): number {
  const shares = demandShares(ctx);
  const avg = 1 / Object.keys(shares).length;
  return Math.min(3, Math.max(0.5, (shares[state] ?? 0) / avg));
}

function askCost(ctx: MarketContext, d: DealTerms, a: DealAsk): number {
  if (a.kind === "shelfSpot") return COFUND_BANNER_COST;
  // Busy stores are scarce where demand is high: every brand wants them
  if (a.kind === "busyStores") return stockValueIn(ctx, d, a.state) * BUSY_STORES_COST_RATE * demandFactor(ctx, a.state);
  const skus = skuById(ctx);
  const share = a.kind === "moreStores" ? MORE_STORES_SHARE : FAST_RESTOCK_SHARE;
  const units = Object.entries(d.stock).map(([id, row]) => ({ id, units: (row[a.state] ?? 0) * share }));
  if (a.kind === "fastRestock") return Math.max(MIN_EXPEDITE_FEE, units.reduce((s, u) => s + u.units, 0) * EXPEDITE_FEE_PER_UNIT);
  const shares = demandShares(ctx);
  const avg = 1 / Object.keys(shares).length;
  const slow = Math.min(3, Math.max(0.5, avg / Math.max(shares[a.state] ?? 0, 1e-6)));
  return units.reduce((s, u) => s + u.units * (skus.get(u.id)?.mrp ?? 0), 0) * SHELF_COST_RATE * slow;
}

const expectedWeekUnits = (ctx: MarketContext, skuIds: readonly string[]) =>
  skuIds.reduce((s, id) => s + (ctx.market.organicDailyUnits[id] ?? 0) * DISCOUNT_DAYS_VALUED, 0);

function discountPerUnit(ctx: MarketContext, skuId: string, p: number): number {
  return Math.round((skuById(ctx).get(skuId)?.mrp ?? 0) * p);
}

function giveValue(ctx: MarketContext, g: DealGive): number {
  if (g.kind === "adSpend") return g.perDay * g.days * PROMISE_CREDIT;
  if (g.kind === "supply") return SUPPLY_PROMISE_VALUE * (g.osaPct / 100);
  return g.skuIds.reduce((s, id) => s + discountPerUnit(ctx, id, g.pct) * (ctx.market.organicDailyUnits[id] ?? 0) * DISCOUNT_DAYS_VALUED, 0) * DISCOUNT_TRAFFIC;
}

/** What the student's asks cost Rohit, in ₹. */
export function valueAsked(ctx: MarketContext, d: DealTerms): number {
  return d.asks.reduce((s, a) => s + askCost(ctx, d, a), 0);
}

/** What the student's offers are worth to Rohit, in ₹. */
export function valueGiven(ctx: MarketContext, d: DealTerms): number {
  return d.gives.reduce((s, g) => s + giveValue(ctx, g), 0);
}

/** Positive: Rohit gets more than he gives. */
export const dealBalance = (ctx: MarketContext, d: DealTerms) => valueGiven(ctx, d) - valueAsked(ctx, d);

/** What a funded discount costs the student over the week (margin given up × expected units). */
export function discountCost(ctx: MarketContext, g: Extract<DealGive, { kind: "discount" }>): number {
  return g.skuIds.reduce((s, id) => s + discountPerUnit(ctx, id, g.pct) * (ctx.market.organicDailyUnits[id] ?? 0) * DISCOUNT_DAYS_VALUED, 0);
}

// ── Negotiation state ────────────────────────────────────────────────────────

export type ObjectionId = "split" | "discount" | "unproven" | "overpromise";
export type TurnKind = "accept" | "counter" | "final" | `objection:${ObjectionId}`;

export type DealChange =
  | { kind: "agree" }
  | { kind: "walkAway" }
  | { kind: "resolve"; objection: ObjectionId; terms: DealTerms; trust: number }
  | { kind: "counter"; terms: DealTerms; trust: number }
  | { kind: "finalAccept"; terms: DealTerms };

export interface DealOption {
  id: string;
  label: string;
  /** Shown before the student picks. */
  cost: string;
  change: DealChange;
}

export interface RohitDealTurn {
  kind: TurnKind;
  line: string;
  chips: readonly DataChip[];
  options: readonly DealOption[];
}

export interface NegotiationState {
  terms: DealTerms;
  handled: readonly ObjectionId[];
  counters: number;
  /** Relationship points earned or lost by replies. */
  trust: number;
  status: "open" | "agreed" | "walkedAway";
  log: readonly { speaker: "rohit" | "student"; text: string }[];
}

export function startNegotiation(_ctx: MarketContext, sheet: DealTerms): NegotiationState {
  return { terms: sheet, handled: [], counters: 0, trust: 0, status: "open", log: [] };
}

const walkAwayOption = (ctx: MarketContext): DealOption => ({
  id: "walkAway", label: "Walk away and keep the brief's terms",
  cost: `No extras: the brief's stock, no promises, relationship ${BASE_RELATIONSHIP}`,
  change: { kind: "walkAway" },
});

const trustCost = (n: number) => (n === 0 ? "No change to Rohit's trust" : n > 0 ? `Rohit's trust +${n}` : `Rohit's trust ${n}`);
const skuName = (ctx: MarketContext, id: string) => skuById(ctx).get(id)?.name ?? id;

// ── Objections (data-backed, each once) ─────────────────────────────────────

/** Biggest overstock gap (stock share minus search share) per placed SKU, if it passes SPLIT_GAP. */
function lopsided(ctx: MarketContext, d: DealTerms): { sku: string; state: string; stock: number; demand: number }[] {
  const shares = demandShares(ctx);
  return Object.entries(d.stock).flatMap(([sku, row]) => {
    const units = unitsIn(row);
    if (units <= 0) return [];
    const worst = Object.keys(shares)
      .map((st) => ({ sku, state: st, stock: (row[st] ?? 0) / units, demand: shares[st] }))
      .sort((a, b) => (b.stock - b.demand) - (a.stock - a.demand))[0];
    return worst && worst.stock - worst.demand > SPLIT_GAP ? [worst] : [];
  }).sort((a, b) => (b.stock - b.demand) - (a.stock - a.demand));
}

function splitObjection(ctx: MarketContext, d: DealTerms): RohitDealTurn | null {
  const off = lopsided(ctx, d);
  if (off.length === 0) return null;
  const worst = off[0];
  const shares = demandShares(ctx);
  const rebalanced: StockSplit = {
    ...d.stock,
    ...Object.fromEntries(off.map((o) => [o.sku, Object.fromEntries(Object.entries(shares).map(([st, w]) => [st, unitsIn(d.stock[o.sku]) * w]))])),
  };
  const others = off.length - 1;
  const what = others > 0 ? "these products' stock" : `${skuName(ctx, worst.sku)} stock`;
  return {
    kind: "objection:split",
    line: `You've put ${pct(worst.stock)} of ${skuName(ctx, worst.sku)} in ${worst.state}, but only ${pct(worst.demand)} of searches in your states come from there${others > 0 ? `, and ${others} other product${others > 1 ? "s are" : " is"} split the same way` : ""}. Stock that doesn't sell blocks my shelf.`,
    chips: [
      { label: `Searches from ${worst.state}`, value: pct(worst.demand), tone: "warn" },
      { label: `Your ${skuName(ctx, worst.sku)} stock in ${worst.state}`, value: pct(worst.stock), tone: "bad" },
    ],
    options: [
      { id: "rebalance", label: `Move ${what} to match where people search`, cost: trustCost(3), change: { kind: "resolve", objection: "split", terms: { ...d, stock: rebalanced }, trust: 3 } },
      { id: "keepSplit", label: "Keep my split: I have a plan for that state", cost: trustCost(-3), change: { kind: "resolve", objection: "split", terms: d, trust: -3 } },
      walkAwayOption(ctx),
    ],
  };
}

function discountObjection(ctx: MarketContext, d: DealTerms): RohitDealTurn | null {
  const g = d.gives.find((x): x is Extract<DealGive, { kind: "discount" }> => x.kind === "discount");
  if (!g) return null;
  const skus = skuById(ctx);
  const hit = g.skuIds.find((id) => discountPerUnit(ctx, id, g.pct) >= (skus.get(id)?.margin ?? 0) * DISCOUNT_MARGIN_SHARE);
  if (!hit) return null;
  const sku = skus.get(hit)!;
  const perUnit = discountPerUnit(ctx, hit, g.pct);
  const without = { ...d, gives: d.gives.filter((x) => x !== g) };
  const halfPct = Math.floor((g.pct / 2) * 20) / 20;
  const halved = { ...d, gives: d.gives.map((x) => (x === g ? { ...g, pct: halfPct } : x)) };
  return {
    kind: "objection:discount",
    line: `A ${pct(g.pct)} discount on ${sku.name} is ${inr(perUnit)} a unit. You only keep ${inr(sku.margin)} a unit. I'll take it, but are you sure you can afford it?`,
    chips: [
      { label: "You keep per unit", value: inr(sku.margin), tone: "neutral" },
      { label: "Discount per unit", value: inr(perUnit), tone: perUnit >= sku.margin ? "bad" : "warn" },
    ],
    options: [
      { id: "withdrawDiscount", label: "Drop the discount", cost: `Saves about ${inr(discountCost(ctx, g))} of margin`, change: { kind: "resolve", objection: "discount", terms: without, trust: 0 } },
      ...(halfPct >= 0.05 ? [{ id: "halveDiscount", label: `Make it ${pct(halfPct)} instead`, cost: `Costs about ${inr(discountCost(ctx, { ...g, pct: halfPct }))} of margin`, change: { kind: "resolve" as const, objection: "discount" as const, terms: halved, trust: 0 } }] : []),
      { id: "keepDiscount", label: "Keep it: I want the shoppers", cost: `Costs about ${inr(discountCost(ctx, g))} of margin`, change: { kind: "resolve", objection: "discount", terms: d, trust: 1 } },
      walkAwayOption(ctx),
    ],
  };
}

function unprovenObjection(ctx: MarketContext, d: DealTerms): RohitDealTurn | null {
  const p = ctx.scenario.profile;
  const shares = demandShares(ctx);
  const ask = d.asks.find((a): a is Extract<DealAsk, { kind: "moreStores" }> =>
    a.kind === "moreStores" && a.state !== p.primaryState && (p.goalType === "Category-Creation" || (shares[a.state] ?? 0) < UNPROVEN_SHARE));
  if (!ask) return null;
  const swapped = { ...d, asks: d.asks.map((a) => (a === ask ? { ...ask, state: p.primaryState } : a)) };
  const dropped = { ...d, asks: d.asks.filter((a) => a !== ask) };
  return {
    kind: "objection:unproven",
    line: p.goalType === "Category-Creation"
      ? `Hardly anyone searches for ${p.category.toLowerCase()} on Blinkit yet. Prove demand in ${p.primaryState} first, then I'll open more stores in ${ask.state}.`
      : `Only ${pct(shares[ask.state] ?? 0)} of your searches come from ${ask.state}. Show me it sells in ${p.primaryState} first.`,
    chips: [
      { label: `Searches from ${ask.state}`, value: pct(shares[ask.state] ?? 0), tone: "warn" },
      { label: `Searches from ${p.primaryState}`, value: pct(shares[p.primaryState] ?? 0), tone: "good" },
    ],
    options: [
      { id: "swapToPrimary", label: `Ask for more stores in ${p.primaryState} instead`, cost: trustCost(2), change: { kind: "resolve", objection: "unproven", terms: swapped, trust: 2 } },
      { id: "dropUnproven", label: "Drop that ask", cost: trustCost(0), change: { kind: "resolve", objection: "unproven", terms: dropped, trust: 0 } },
      { id: "keepUnproven", label: `Keep it: ${ask.state} is part of my plan`, cost: trustCost(-4), change: { kind: "resolve", objection: "unproven", terms: d, trust: -4 } },
      walkAwayOption(ctx),
    ],
  };
}

function overpromiseObjection(ctx: MarketContext, d: DealTerms): RohitDealTurn | null {
  const g = d.gives.find((x): x is Extract<DealGive, { kind: "adSpend" }> => x.kind === "adSpend");
  const budget = ctx.scenario.budget;
  if (!g || g.perDay * g.days <= budget * OVERPROMISE_SHARE) return null;
  const share = (g.perDay * g.days) / budget;
  const lowerPerDay = Math.floor((budget * LOWER_SPEND_SHARE) / g.days / SPEND_STEP) * SPEND_STEP;
  const lowered = { ...d, gives: d.gives.map((x) => (x === g ? { ...g, perDay: lowerPerDay } : x)) };
  return {
    kind: "objection:overpromise",
    line: `${inr(g.perDay * g.days)} is ${pct(share)} of your whole budget, promised in ${g.days} days. If you break that promise, I'll remember.`,
    chips: [
      { label: "Your budget for 30 days", value: inr(budget), tone: "neutral" },
      { label: "Share you're promising", value: pct(share), tone: "bad" },
    ],
    options: [
      { id: "lowerSpend", label: `Promise ${inr(lowerPerDay * g.days)} instead`, cost: trustCost(1), change: { kind: "resolve", objection: "overpromise", terms: lowered, trust: 1 } },
      { id: "keepSpend", label: "Keep the promise", cost: `${trustCost(0)}, but breaking it later costs trust`, change: { kind: "resolve", objection: "overpromise", terms: d, trust: 0 } },
      walkAwayOption(ctx),
    ],
  };
}

const OBJECTIONS: readonly { id: ObjectionId; build: (ctx: MarketContext, d: DealTerms) => RohitDealTurn | null }[] = [
  { id: "split", build: splitObjection },
  { id: "discount", build: discountObjection },
  { id: "unproven", build: unprovenObjection },
  { id: "overpromise", build: overpromiseObjection },
];

// ── Counters and closing ─────────────────────────────────────────────────────

function priciestAsk(ctx: MarketContext, d: DealTerms): DealAsk | undefined {
  return [...d.asks].sort((a, b) => askCost(ctx, d, b) - askCost(ctx, d, a))[0];
}

function withExtraSpend(d: DealTerms, gapRupees: number): DealTerms {
  const existing = d.gives.find((g): g is Extract<DealGive, { kind: "adSpend" }> => g.kind === "adSpend");
  const days = existing?.days ?? ADD_SPEND_DAYS;
  const extraPerDay = Math.ceil(gapRupees / PROMISE_CREDIT / days / SPEND_STEP) * SPEND_STEP;
  const give: DealGive = { kind: "adSpend", perDay: (existing?.perDay ?? 0) + extraPerDay, days };
  return { ...d, gives: existing ? d.gives.map((g) => (g === existing ? give : g)) : [...d.gives, give] };
}

function counterTurn(ctx: MarketContext, s: NegotiationState): RohitDealTurn {
  const d = s.terms;
  const asked = valueAsked(ctx, d), given = valueGiven(ctx, d);
  const ask = priciestAsk(ctx, d);
  const dropped = ask ? { ...d, asks: d.asks.filter((a) => a !== ask) } : d;
  const more = withExtraSpend(d, asked - given);
  const addG = more.gives.find((g) => g.kind === "adSpend") as Extract<DealGive, { kind: "adSpend" }>;
  const chips: DataChip[] = [
    { label: "What you're asking for is worth", value: inr(asked), tone: "neutral" },
    { label: "What you're offering is worth", value: inr(given), tone: given < asked ? "bad" : "good" },
  ];
  const label = (a: DealAsk) => askLabel(a, "the");
  if (s.counters >= MAX_COUNTERS) {
    return {
      kind: "final",
      line: `Last offer: I'll do everything except ${ask ? label(ask) : "the extras"}. Take it or keep the brief's terms.`,
      chips,
      options: [
        { id: "finalAccept", label: "Take Rohit's last offer", cost: ask ? `You lose ${label(ask)}` : trustCost(0), change: { kind: "finalAccept", terms: dropped } },
        walkAwayOption(ctx),
      ],
    };
  }
  return {
    kind: "counter",
    line: `You're asking for ${inr(asked)} of value and offering ${inr(given)}. Either drop ${ask ? label(ask) : "something"}, or put more ad spend behind my category.`,
    chips,
    options: [
      { id: "dropAsk", label: `Drop ${ask ? label(ask) : "an ask"}`, cost: trustCost(1), change: { kind: "counter", terms: dropped, trust: 1 } },
      { id: "addSpend", label: `Promise ${inr(addG.perDay * addG.days)} of ad spend by day ${addG.days}`, cost: `A tracked promise of ${inr(addG.perDay * addG.days)}`, change: { kind: "counter", terms: more, trust: 2 } },
      { id: "insist", label: "That's my offer", cost: trustCost(-2), change: { kind: "counter", terms: d, trust: -2 } },
      walkAwayOption(ctx),
    ],
  };
}

/** True when the deal includes promises Rohit will check during the run. */
export const hasPromises = (d: DealTerms) => d.gives.some((g) => g.kind === "adSpend" || g.kind === "supply");

function acceptTurn(ctx: MarketContext, s: NegotiationState): RohitDealTurn {
  const given = valueGiven(ctx, s.terms), asked = valueAsked(ctx, s.terms);
  const hold = hasPromises(s.terms) ? " I'll hold you to your promises." : "";
  return {
    kind: "accept",
    line: asked === 0 && given === 0
      ? "Fair enough. I'll stock what you've placed, no extras either way."
      : asked === 0
        ? `You're offering me ${inr(given)} and asking for nothing back. I'll happily take that.${hold}`
        : `Deal. You get ${inr(asked)} of value from me and I get ${inr(given)} from you.${hold}`,
    chips: [
      { label: "Stock where people search", value: pct(stockFit(ctx, s.terms)), tone: stockFit(ctx, s.terms) >= 0.8 ? "good" : "warn" },
    ],
    options: [
      { id: "agree", label: "Shake on it", cost: "Starts the run with these terms", change: { kind: "agree" } },
      walkAwayOption(ctx),
    ],
  };
}

/** Rohit's next turn, or null once the negotiation has closed. */
export function rohitTurn(ctx: MarketContext, s: NegotiationState): RohitDealTurn | null {
  if (s.status !== "open") return null;
  for (const o of OBJECTIONS) {
    if (s.handled.includes(o.id)) continue;
    const turn = o.build(ctx, s.terms);
    if (turn) return turn;
  }
  return dealBalance(ctx, s.terms) < 0 ? counterTurn(ctx, s) : acceptTurn(ctx, s);
}

export function chooseOption(ctx: MarketContext, s: NegotiationState, option: DealOption): NegotiationState {
  const turn = rohitTurn(ctx, s);
  const log = [...s.log, ...(turn ? [{ speaker: "rohit" as const, text: turn.line }] : []), { speaker: "student" as const, text: option.label }];
  const c = option.change;
  switch (c.kind) {
    case "walkAway": return { ...s, status: "walkedAway", log };
    case "agree": return { ...s, status: "agreed", log };
    case "finalAccept": return { ...s, terms: c.terms, status: "agreed", log };
    case "resolve": return { ...s, terms: c.terms, handled: [...s.handled, c.objection], trust: s.trust + c.trust, log };
    case "counter": return { ...s, terms: c.terms, counters: s.counters + 1, trust: s.trust + c.trust, log };
  }
}

/** The agreed (or walk-away) terms and where the relationship meter starts. */
export function dealOutcome(ctx: MarketContext, s: NegotiationState): { terms: DealTerms; relationship: number } {
  if (s.status !== "agreed") return { terms: walkAwayDeal(ctx), relationship: BASE_RELATIONSHIP };
  const r = BASE_RELATIONSHIP + 12 * Math.tanh(dealBalance(ctx, s.terms) / 25000) + 10 * (stockFit(ctx, s.terms) - 0.8) + s.trust;
  return { terms: s.terms, relationship: Math.round(Math.max(30, Math.min(80, r))) };
}

/** An ask in plain words, e.g. "busier dark stores in Delhi" (article: "a"/"the" where it takes one). */
export function askLabel(a: DealAsk, article: "a" | "the"): string {
  switch (a.kind) {
    case "moreStores": return `more stores in ${a.state}`;
    case "busyStores": return `busier dark stores in ${a.state}`;
    case "fastRestock": return `${article} fast restock in ${a.state}`;
    case "shelfSpot": return `${article} better shelf spot`;
  }
}
