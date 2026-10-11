// ── Rohit, the category manager: context-aware asks (SPEC §6) ────────────────
// Every ask has a precondition on live data, so Rohit never asks for
// something the data already answers. Each ask carries data chips (the
// numbers behind his line) and 2–4 replies. Every reply shows its cost or
// commitment up front, its effect as data (applied by the live dashboard
// later) and a quality used for scoring. Promises become Commitments that are
// checked against the run and feed the relationship meter.

import type { DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { CITY_STORE_COUNT, STATE_TO_CITIES, BLINKIT_STATES, type CityName } from "@/data/scenarios";
import { osa, restockAmount, initialUnits, RESTOCK_INTERVAL_DAYS } from "@/market/stock";
import { streamFor } from "@/market/rng";
import {
  inr, pct, sumCells, targetedPairs, today, lastDay, isLiveOn,
  type CellTotals, type EventInput,
} from "@/market/events";

// ── Types ────────────────────────────────────────────────────────────────────

export type AskId =
  | "restock" | "cofund_banner" | "match_discount" | "sov_threat"
  | "overstock_clearance" | "new_dark_stores" | "roas_below_breakeven";

export type ChipTone = "neutral" | "good" | "warn" | "bad";

/** A labelled number backing one of Rohit's lines, e.g. "OSA Telangana" · "42%". */
export interface DataChip {
  label: string;
  value: string;
  tone: ChipTone;
}

export type ReplyQuality = "strong" | "ok" | "weak";

/** What a reply does, as data. The live dashboard applies it. */
export interface ReplyEffect {
  relationshipDelta: number;
  /** ₹ the student pays now (counts against the ₹2 lakh budget). */
  cost?: number;
  /** Units per SKU arriving in a state after N days. */
  restock?: { state: string; units: Readonly<Record<string, number>>; afterDays: number };
  /** A funded discount: price cut and the margin given up per unit. */
  discount?: { pct: number; skuIds: readonly string[]; days: number; marginPerUnit: Readonly<Record<string, number>> };
  /** States the student pulls ads from. */
  dropStates?: readonly string[];
  /** Extra daily budget the student promises (optionally on terms or a state). */
  budgetCommit?: { perDay: number; days: number; terms?: readonly string[]; state?: string };
  /** Better shelf placement from a co-funded banner (relevance multiplier). */
  shelfBoost?: { relevanceMult: number; days: number };
  /** Stock arriving in a new state (dark-store cluster). */
  addStock?: { state: string; units: Readonly<Record<string, number>>; fromDay: number };
}

export type CommitmentKind = "osa_at_least" | "spend_at_least" | "units_at_least" | "covers_ad_spend";

/** A promise made in a reply, checked later (SPEC §6 "Promises are tracked"). */
export interface Commitment {
  id: string;
  askId: AskId;
  /** Plain description for the Commitments list. */
  text: string;
  kind: CommitmentKind;
  /** OSA share, ₹, or units; unused for covers_ad_spend. */
  target: number;
  fromDay: number;
  dueDay: number;
  state?: string;
  skuIds?: readonly string[];
  terms?: readonly string[];
  keptDelta: number;
  brokenDelta: number;
}

export type CommitmentDraft = Omit<Commitment, "id" | "askId">;

export interface ReplyOption {
  id: string;
  label: string;
  /** Shown before the student picks: ₹, stock, or what they give up. */
  cost: string;
  effect: ReplyEffect;
  quality: ReplyQuality;
  commitment?: CommitmentDraft;
}

export interface RohitAsk {
  id: AskId;
  title: string;
  line: string;
  chips: readonly DataChip[];
  options: readonly ReplyOption[];
  /** Applies whatever the reply (e.g. the new cluster's stock). */
  situationEffect?: ReplyEffect;
}

export interface RohitInput extends Pick<EventInput, "ctx" | "state" | "history" | "campaigns"> {
  /** Relationship meter, 0–100. */
  relationship: number;
}

export interface AskDef {
  id: AskId;
  title: string;
  precondition: (input: RohitInput) => boolean;
  build: (input: RohitInput) => RohitAsk;
}

// ── Tunables ─────────────────────────────────────────────────────────────────

export const RESTOCK_ASK_OSA = 0.5;
export const HEALTHY_OSA = 0.7;
/** Weekly units sold ÷ units on hand counted as strong sell-through. */
export const STRONG_SELL_THROUGH = 0.3;
export const COFUND_BANNER_COST = 15000;
export const SOV_THREAT = 0.2;
export const LOSS_STREAK_DAYS = 3;
export const EXPEDITE_FEE_PER_UNIT = 8;
export const MIN_EXPEDITE_FEE = 5000;
/** Co-funding a matched discount needs at least a neutral relationship. */
export const COFUND_RELATIONSHIP = 50;
export const MAX_CHECKINS_PER_RUN = 3;
/** Suggested check-in days; the dashboard opens one when an ask is eligible. */
export const CHECK_IN_DAYS: readonly number[] = [6, 13, 20];

// ── Live metrics ─────────────────────────────────────────────────────────────

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
const roas = (t: CellTotals) => ratio(t.revenue, t.spend);
/** Revenue-weighted break-even ROAS of what sold (F9). */
const breakEven = (t: CellTotals) => ratio(t.revenue, t.contribution);
const fmtRoas = (x: number) => x.toFixed(1);

function sku(ctx: MarketContext, id: string) {
  return ctx.scenario.profile.skus.find((s) => s.id === id);
}

/** Current OSA of a SKU in a state, from the units on hand. */
export function currentOsa(ctx: MarketContext, state: MarketState, skuId: string, st: string): number {
  const s = sku(ctx, skuId);
  if (!s) return 0;
  return osa(state.stock[skuId]?.[st] ?? 0, CITY_STORE_COUNT[st as CityName] ?? 0, s.velocity);
}

const avgDailyUnits = (state: MarketState, skuId: string, st: string) => avg(state.salesWindow[`${skuId}|${st}`] ?? []);

interface PairOsa { skuId: string; state: string; osa: number; units: number; daily: number }

function targetedOsa(input: RohitInput): readonly PairOsa[] {
  return Array.from(targetedPairs(input)).map((pair) => {
    const [skuId, st] = pair.split("|");
    return { skuId, state: st, osa: currentOsa(input.ctx, input.state, skuId, st), units: input.state.stock[skuId]?.[st] ?? 0, daily: avgDailyUnits(input.state, skuId, st) };
  });
}

const recentCells = (history: readonly DayResult[], n: number) => history.slice(-n).flatMap((d) => d.cells);

function osaTone(x: number): ChipTone {
  return x >= HEALTHY_OSA ? "good" : x >= RESTOCK_ASK_OSA ? "warn" : "bad";
}

/** Chip labels explain each term the first time a student meets it. */
export const CHIP_TERMS = {
  osa: (state: string) => `Stores with stock (OSA), ${state}`,
  roas: (scope: string) => `Sales per ₹1 of ads (ROAS), ${scope}`,
  sov: (term: string) => `Your share of ad views (SOV) on "${term}"`,
  cvr: "Clicks that end in a sale (CVR)",
  cover: "Days of stock left",
  sellThrough: "Stock sold per week (sell-through)",
} as const;

function roasChip(scope: string, t: CellTotals): DataChip {
  const be = breakEven(t);
  return { label: CHIP_TERMS.roas(scope), value: `${fmtRoas(roas(t))}, needs ${fmtRoas(be)} to break even`, tone: roas(t) >= be ? "good" : "bad" };
}

const nextRestockDay = (day: number) => Math.ceil((day + 1) / RESTOCK_INTERVAL_DAYS) * RESTOCK_INTERVAL_DAYS;

// ── 1. Restock or pull out (OSA < 50% in a targeted state) ──────────────────

function worstLowOsa(input: RohitInput): PairOsa | undefined {
  return [...targetedOsa(input)].filter((p) => p.osa < RESTOCK_ASK_OSA).sort((a, b) => a.osa - b.osa)[0];
}

const restock: AskDef = {
  id: "restock", title: "Send stock or stop the ads",
  precondition: (input) => worstLowOsa(input) !== undefined,
  build: (input) => {
    const p = worstLowOsa(input)!;
    const day = today(input);
    const lowSkus = targetedOsa(input).filter((x) => x.state === p.state && x.osa < RESTOCK_ASK_OSA);
    const units = Object.fromEntries(lowSkus.map((x) => [x.skuId, Math.max(50, Math.round(restockAmount(x.units, Math.max(x.daily, 1), "healthy")))]));
    const totalUnits = Object.values(units).reduce((s, u) => s + u, 0);
    const fee = Math.max(MIN_EXPEDITE_FEE, totalUnits * EXPEDITE_FEE_PER_UNIT);
    const cover = ratio(p.units, p.daily);
    const stateT = sumCells(recentCells(input.history, 3), (c) => c.state === p.state);
    const profitable = stateT.spend > 0 && roas(stateT) >= breakEven(stateT);
    const skuName = sku(input.ctx, p.skuId)?.name ?? p.skuId;
    const restockDay = nextRestockDay(input.state.day);
    return {
      id: "restock", title: "Send stock or stop the ads",
      line: `Only ${pct(p.osa)} of stores in ${p.state} have ${skuName} in stock. Why pay for ads there? Send more stock, or stop the ads there.`,
      chips: [
        { label: CHIP_TERMS.osa(p.state), value: pct(p.osa), tone: osaTone(p.osa) },
        { label: "Units left", value: Math.round(p.units).toLocaleString("en-IN"), tone: "neutral" },
        { label: CHIP_TERMS.cover, value: p.daily > 0 ? cover.toFixed(1) : "No sales lately", tone: cover < 3 ? "bad" : "warn" },
        ...(stateT.spend > 0 ? [roasChip(`${p.state}, last 3 days`, stateT)] : []),
      ],
      options: [
        {
          id: "expedite", label: `Rush ${totalUnits.toLocaleString("en-IN")} units to ${p.state}`,
          cost: `Costs ${inr(fee)} now. Stock arrives in 2 days.`,
          effect: { relationshipDelta: 4, cost: fee, restock: { state: p.state, units, afterDays: 2 } },
          quality: profitable ? "strong" : "ok",
          commitment: { text: `More than half the stores in ${p.state} have stock again by day ${day + 3}`, kind: "osa_at_least", target: RESTOCK_ASK_OSA, fromDay: day, dueDay: day + 3, state: p.state, skuIds: lowSkus.map((x) => x.skuId), keptDelta: 6, brokenDelta: -10 },
        },
        {
          id: "pull_out", label: `Stop ads in ${p.state} until stock is back`,
          cost: `No cost. You lose ${p.state} sales until the next delivery on day ${restockDay}.`,
          effect: { relationshipDelta: 2, dropStates: [p.state] },
          quality: profitable ? "ok" : "strong",
        },
        {
          id: "keep_running", label: "Keep the ads running. It will sell out anyway.",
          cost: "No cost. Ads stop by themselves when shelves are empty.",
          effect: { relationshipDelta: -5 },
          quality: "weak",
        },
      ],
    };
  },
};

// ── 2. Co-fund a homepage banner (OSA healthy, sell-through strong) ─────────

interface SellThrough { minOsa: number; weekly: number }

function sellThrough(input: RohitInput): SellThrough | null {
  const pairs = targetedOsa(input).filter((p) => p.units > 0 || p.osa > 0);
  if (!pairs.length) return null;
  const windows = pairs.map((p) => input.state.salesWindow[`${p.skuId}|${p.state}`] ?? []);
  if (Math.min(...windows.map((w) => w.length)) < 5) return null;
  const sold = windows.reduce((s, w) => s + avg(w) * 7, 0);
  const onHand = pairs.reduce((s, p) => s + p.units, 0);
  return { minOsa: Math.min(...pairs.map((p) => p.osa)), weekly: ratio(sold, onHand) };
}

const cofundBanner: AskDef = {
  id: "cofund_banner", title: "Pay towards a homepage banner",
  precondition: (input) => {
    const st = sellThrough(input);
    return !!st && st.minOsa >= HEALTHY_OSA && st.weekly >= STRONG_SELL_THROUGH;
  },
  build: (input) => {
    const st = sellThrough(input)!;
    const week = sumCells(recentCells(input.history, 7));
    const profitable = week.spend > 0 && roas(week) >= breakEven(week);
    return {
      id: "cofund_banner", title: "Pay towards a homepage banner",
      line: `Your products are selling well. Pay ${inr(COFUND_BANNER_COST)} towards a homepage banner and I'll give you better shelf spots in the app.`,
      chips: [
        { label: "Lowest stores-with-stock (OSA) in your states", value: pct(st.minOsa), tone: osaTone(st.minOsa) },
        { label: CHIP_TERMS.sellThrough, value: pct(st.weekly), tone: "good" },
        ...(week.spend > 0 ? [roasChip("last 7 days", week)] : []),
      ],
      options: [
        {
          id: "fund", label: `Pay for the banner (${inr(COFUND_BANNER_COST)})`,
          cost: `Costs ${inr(COFUND_BANNER_COST)} now, from your ad budget.`,
          effect: { relationshipDelta: 8, cost: COFUND_BANNER_COST, shelfBoost: { relevanceMult: 1.1, days: 10 } },
          quality: profitable ? "strong" : "weak",
        },
        {
          id: "half", label: `Offer half (${inr(COFUND_BANNER_COST / 2)}) for a shorter run`,
          cost: `Costs ${inr(COFUND_BANNER_COST / 2)} now. Better shelf spots for 5 days.`,
          effect: { relationshipDelta: 3, cost: COFUND_BANNER_COST / 2, shelfBoost: { relevanceMult: 1.1, days: 5 } },
          quality: "ok",
        },
        {
          id: "decline", label: "Say no. My ad money earns more elsewhere.",
          cost: profitable ? "No cost. You miss the better shelf spots." : "No cost. Your ads lose money right now, so fixing them comes first.",
          effect: { relationshipDelta: profitable ? -2 : 1 },
          quality: profitable ? "ok" : "strong",
        },
      ],
    };
  },
};

// ── 3. Match a rival's discount (rival price cut detected) ──────────────────

function activePriceCut(input: RohitInput) {
  const terms = new Set(input.campaigns.flatMap((c) => c.keywords.map((k) => k.term)));
  return input.ctx.market.rivals.find((r) =>
    r.priceCut && input.state.day >= r.priceCut.day && input.state.day <= r.priceCut.day + 7 &&
    Object.keys(r.bids).some((t) => terms.has(t)));
}

const matchDiscount: AskDef = {
  id: "match_discount", title: "Match a rival's discount",
  precondition: (input) => activePriceCut(input) !== undefined,
  build: (input) => {
    const r = activePriceCut(input)!;
    const cut = r.priceCut!;
    const shared = (c: { inventory: string; term: string }) => c.inventory === "keyword" && r.bids[c.term] !== undefined;
    const before = sumCells(input.history.filter((d) => d.day < cut.day).slice(-7).flatMap((d) => d.cells), shared);
    const after = sumCells(input.history.filter((d) => d.day >= cut.day).flatMap((d) => d.cells), shared);
    const skuIds = Array.from(new Set(input.campaigns.flatMap((c) => c.skuIds)));
    const discountPct = 0.1;
    const marginPerUnit = Object.fromEntries(skuIds.map((id) => [id, Math.round((sku(input.ctx, id)?.mrp ?? 0) * discountPct)]));
    const hero = sku(input.ctx, skuIds[0]);
    const canCofund = input.relationship >= COFUND_RELATIONSHIP;
    return {
      id: "match_discount", title: "Match a rival's discount",
      line: `${r.name} cut its price by ${pct(cut.pct)}. Will you pay for a discount to match?`,
      chips: [
        { label: `${r.name} price`, value: `${inr(r.price)} → ${inr(r.price * (1 - cut.pct))}`, tone: "bad" },
        ...(hero ? [{ label: "What you keep per unit (margin)", value: `${inr(hero.margin)} of ${inr(hero.mrp)}`, tone: "neutral" as ChipTone }] : []),
        ...(before.clicks > 0 && after.clicks > 0
          ? [{ label: `${CHIP_TERMS.cvr}, keywords you share`, value: `${pct(ratio(before.units, before.clicks))} → ${pct(ratio(after.units, after.clicks))}`, tone: (ratio(after.units, after.clicks) < ratio(before.units, before.clicks) ? "bad" : "neutral") as ChipTone }]
          : []),
      ],
      options: [
        {
          id: "shift", label: `Move money to keywords ${r.name} doesn't bid on`,
          cost: "No cost. Fewer sales on the keywords you both use.",
          effect: { relationshipDelta: 2 },
          quality: "strong",
        },
        {
          id: "match", label: "Pay for a 10% discount for 7 days",
          cost: hero ? `You keep ${inr(marginPerUnit[hero.id])} less per unit (${inr(hero.margin - marginPerUnit[hero.id])} instead of ${inr(hero.margin)}).` : "You keep 10% of the price less per unit.",
          effect: { relationshipDelta: 5, discount: { pct: discountPct, skuIds, days: 7, marginPerUnit } },
          quality: "ok",
        },
        {
          id: "cofund", label: "Ask Blinkit to pay half the discount",
          cost: canCofund ? "You give up 5% of the price per unit, if Rohit agrees." : "Rohit only agrees if your relationship is good. It isn't yet.",
          effect: canCofund
            ? { relationshipDelta: 0, discount: { pct: discountPct, skuIds, days: 7, marginPerUnit: Object.fromEntries(Object.entries(marginPerUnit).map(([k, v]) => [k, Math.round(v / 2)])) } }
            : { relationshipDelta: -3 },
          quality: canCofund ? "strong" : "weak",
        },
        {
          id: "ignore", label: "Do nothing. It will pass.",
          cost: "No cost. Fewer clicks turn into sales for now.",
          effect: { relationshipDelta: -2 },
          quality: "weak",
        },
      ],
    };
  },
};

// ── 4. SOV threat on a category head term (< 20%) ───────────────────────────

interface HeadTermSov { term: string; sov: number; totals: CellTotals; topRival?: { name: string; sov: number } }

function weakHeadTerm(input: RohitInput): HeadTermSov | undefined {
  if (input.history.length < 2) return undefined;
  const live = input.campaigns.filter((c) => isLiveOn(c, today(input), input.ctx.totalDays));
  const bidTerms = new Set(live.flatMap((c) => c.keywords.map((k) => k.term)));
  const heads = input.ctx.market.keywords.filter((k) => k.tier === "head" && bidTerms.has(k.term)).map((k) => k.term);
  const recent = input.history.slice(-3);
  const cells = recent.flatMap((d) => d.cells);
  return heads
    .map((term) => {
      const totals = sumCells(cells, (c) => c.term === term && c.matchType === "exact");
      const rivals = recent.flatMap((d) => d.rivals).filter((r) => r.term === term);
      const byRival = Array.from(new Set(rivals.map((r) => r.rivalId))).map((id) => {
        const rows = rivals.filter((r) => r.rivalId === id);
        return { name: input.ctx.market.rivals.find((x) => x.id === id)?.name ?? id, sov: ratio(rows.reduce((s, r) => s + r.viewableImpressions, 0), rows.reduce((s, r) => s + r.totalAdViewable, 0)) };
      }).sort((a, b) => b.sov - a.sov);
      return { term, totals, sov: ratio(totals.viewable, totals.totalAdViewable), topRival: byRival[0] };
    })
    .filter((h) => h.totals.searches > 0 && h.sov < SOV_THREAT)
    .sort((a, b) => a.sov - b.sov)[0];
}

const sovThreat: AskDef = {
  id: "sov_threat", title: "Losing a popular keyword",
  precondition: (input) => weakHeadTerm(input) !== undefined,
  build: (input) => {
    const h = weakHeadTerm(input)!;
    const day = today(input);
    const days = Math.min(3, input.history.length);
    const dailySpend = h.totals.spend / days;
    const extra = roundTo(Math.max(1000, dailySpend * 0.3), 500);
    const profitable = h.totals.spend > 0 && roas(h.totals) >= breakEven(h.totals);
    const who = h.topRival ? h.topRival.name : "Your rivals";
    return {
      id: "sov_threat", title: "Losing a popular keyword",
      line: `${who} ${h.topRival ? "is" : "are"} winning most ads on "${h.term}". You get only ${pct(h.sov)} of the ad views there. What is your plan?`,
      chips: [
        { label: CHIP_TERMS.sov(h.term), value: pct(h.sov), tone: "bad" },
        ...(h.topRival ? [{ label: `${h.topRival.name}'s share of ad views`, value: pct(h.topRival.sov), tone: "neutral" as ChipTone }] : []),
        ...(h.totals.spend > 0 ? [roasChip(`"${h.term}"`, h.totals)] : []),
      ],
      options: [
        {
          id: "commit_budget", label: `Put ${inr(extra)} a day more behind "${h.term}" for 7 days`,
          cost: `Costs ${inr(extra * 7)} over 7 days.`,
          effect: { relationshipDelta: 4, budgetCommit: { perDay: extra, days: 7, terms: [h.term] } },
          quality: profitable ? "strong" : "weak",
          commitment: { text: `Spend at least ${inr((dailySpend + extra) * 7 * 0.9)} on "${h.term}" by day ${day + 6}`, kind: "spend_at_least", target: Math.round((dailySpend + extra) * 7 * 0.9), fromDay: day, dueDay: day + 6, terms: [h.term], keptDelta: 5, brokenDelta: -8 },
        },
        {
          id: "long_tail", label: `Let "${h.term}" go. Move the money to longer, cheaper searches.`,
          cost: profitable ? `No cost. You give up a keyword that makes money.` : `No cost. "${h.term}" loses money at today's prices anyway.`,
          effect: { relationshipDelta: profitable ? 0 : 2 },
          quality: profitable ? "ok" : "strong",
        },
        {
          id: "raise_all", label: "Raise every bid by 20%",
          cost: "Every ad costs more, including ones that already lose money.",
          effect: { relationshipDelta: 0 },
          quality: "weak",
        },
      ],
    };
  },
};

// ── 5. Overstock / aging clearance (scenario inventory overstocked) ─────────

const overstockClearance: AskDef = {
  id: "overstock_clearance", title: "Sell old stock",
  precondition: (input) => input.ctx.scenario.inventory.tone === "overstocked" && input.state.day <= input.ctx.totalDays - 5,
  build: (input) => {
    const aging = input.ctx.scenario.inventory.agingUnits;
    const day = today(input);
    const pairs = targetedOsa(input);
    const onHand = pairs.reduce((s, p) => s + p.units, 0);
    const daily = pairs.reduce((s, p) => s + p.daily, 0);
    const skuIds = Array.from(new Set(input.campaigns.flatMap((c) => c.skuIds)));
    const margin = (p: number) => Object.fromEntries(skuIds.map((id) => [id, Math.round((sku(input.ctx, id)?.mrp ?? 0) * p)]));
    const target = Math.round(aging * 0.6);
    return {
      id: "overstock_clearance", title: "Sell old stock",
      line: `${aging.toLocaleString("en-IN")} of your units have been sitting in stores too long. Help me sell them. A combo pack or a quick sale?`,
      chips: [
        { label: "Old units in stores", value: aging.toLocaleString("en-IN"), tone: "bad" },
        { label: "Units in your states", value: Math.round(onHand).toLocaleString("en-IN"), tone: "neutral" },
        { label: CHIP_TERMS.cover, value: daily > 0 ? Math.round(onHand / daily).toString() : "No sales lately", tone: "warn" },
      ],
      options: [
        {
          id: "bundle", label: "Sell a combo pack at 10% off for 7 days",
          cost: "You keep 10% of the price less on each unit sold.",
          effect: { relationshipDelta: 5, discount: { pct: 0.1, skuIds, days: 7, marginPerUnit: margin(0.1) } },
          quality: "strong",
          commitment: { text: `Sell ${target.toLocaleString("en-IN")} units by day ${day + 6}`, kind: "units_at_least", target, fromDay: day, dueDay: day + 6, skuIds, keptDelta: 6, brokenDelta: -6 },
        },
        {
          id: "flash", label: "Run a 25% off sale for 2 days",
          cost: "You keep 25% of the price less per unit. Shoppers may expect it cheap later.",
          effect: { relationshipDelta: 3, discount: { pct: 0.25, skuIds, days: 2, marginPerUnit: margin(0.25) } },
          quality: "ok",
        },
        {
          id: "not_now", label: "Not now. I want to keep my price.",
          cost: "No cost. The old stock stays in Rohit's stores.",
          effect: { relationshipDelta: -4 },
          quality: "weak",
        },
      ],
    };
  },
};

// ── 6. New dark stores / cluster opening (seeded, adds a 4th state) ─────────

export interface ClusterOpening {
  state: string;
  city: string;
  announceDay: number;
  openDay: number;
  stores: number;
  /** Units per SKU that land on openDay. */
  units: Readonly<Record<string, number>>;
}

/** Cluster OSA when it opens (units sized from it). */
const CLUSTER_OPEN_OSA = 70;

/**
 * The seeded mid-run cluster: an unstocked state among the six with the most
 * dark stores, announced between days 9 and 15, opening 5 days later.
 */
export function clusterOpening(ctx: MarketContext): ClusterOpening | null {
  const unstocked = BLINKIT_STATES
    .filter((s) => (ctx.scenario.cityStockMap[s] ?? 0) === 0)
    .sort((a, b) => (CITY_STORE_COUNT[b] ?? 0) - (CITY_STORE_COUNT[a] ?? 0))
    .slice(0, 6);
  if (!unstocked.length) return null;
  const rand = streamFor(ctx.seed, "rohit", "cluster");
  const st = unstocked[Math.min(unstocked.length - 1, Math.floor(rand() * unstocked.length))];
  const announceDay = 9 + Math.floor(rand() * 7);
  const stores = CITY_STORE_COUNT[st] ?? 0;
  return {
    state: st,
    city: STATE_TO_CITIES[st]?.[0]?.name ?? st,
    announceDay,
    openDay: announceDay + 5,
    stores,
    units: Object.fromEntries(ctx.scenario.profile.skus.map((s) => [s.id, Math.round(initialUnits(CLUSTER_OPEN_OSA, stores, s.velocity))])),
  };
}

const newDarkStores: AskDef = {
  id: "new_dark_stores", title: "New stores opening",
  precondition: (input) => {
    const c = clusterOpening(input.ctx);
    const day = today(input);
    return !!c && day >= c.announceDay && day < c.openDay;
  },
  build: (input) => {
    const c = clusterOpening(input.ctx)!;
    const day = today(input);
    const live = input.campaigns.filter((x) => isLiveOn(x, day, input.ctx.totalDays));
    const covered = live.some((x) => x.geography === "pan_india" || x.cities.includes(c.state));
    const week = sumCells(recentCells(input.history, 7));
    const profitable = week.spend > 0 && roas(week) >= breakEven(week);
    const perDay = 1500;
    return {
      id: "new_dark_stores", title: "New stores opening",
      line: `New stores open in ${c.city}, ${c.state} on day ${c.openDay}, and your products will be stocked there. Will you advertise to help the launch?`,
      chips: [
        { label: `Blinkit stores in ${c.state} (dark stores)`, value: c.stores.toString(), tone: "neutral" },
        { label: "Opens", value: `Day ${c.openDay}`, tone: "neutral" },
        { label: "Your ads already reach it", value: covered ? "Yes" : "No", tone: covered ? "good" : "warn" },
        ...(week.spend > 0 ? [roasChip("last 7 days", week)] : []),
      ],
      situationEffect: { relationshipDelta: 0, addStock: { state: c.state, units: c.units, fromDay: c.openDay } },
      options: [
        {
          id: "launch_support", label: `Spend ${inr(perDay)} a day in ${c.state} for 5 days`,
          cost: `Costs ${inr(perDay * 5)} over 5 days, in a place with no sales history yet.`,
          effect: { relationshipDelta: 6, budgetCommit: { perDay, days: 5, state: c.state } },
          quality: profitable ? "strong" : "ok",
          commitment: { text: `Spend at least ${inr(perDay * 5 * 0.8)} in ${c.state} by day ${c.openDay + 4}`, kind: "spend_at_least", target: perDay * 5 * 0.8, fromDay: c.openDay, dueDay: c.openDay + 4, state: c.state, keptDelta: 5, brokenDelta: -8 },
        },
        {
          id: "cover_it", label: covered ? "My all-India ads will show there once stock arrives" : `Add ${c.state} to my ads once stock arrives`,
          cost: "No extra cost. It shares the budget you already have.",
          effect: { relationshipDelta: 2 },
          quality: covered ? "strong" : "ok",
        },
        {
          id: "stay", label: "Stick to the states that already work",
          cost: "No cost. You miss the first shoppers in the new stores.",
          effect: { relationshipDelta: -2 },
          quality: profitable ? "weak" : "ok",
        },
      ],
    };
  },
};

// ── 7. ROAS below break-even for 3+ days ────────────────────────────────────

function lossStreak(history: readonly DayResult[]): boolean {
  const recent = history.slice(-LOSS_STREAK_DAYS);
  return recent.length === LOSS_STREAK_DAYS && recent.every((d) => {
    const t = sumCells(d.cells);
    return t.spend > 0 && t.contribution < t.spend;
  });
}

function worstKeyword(cells: readonly DayResult["cells"][number][]): { term: string; totals: CellTotals } | undefined {
  const terms = Array.from(new Set(cells.filter((c) => c.inventory === "keyword").map((c) => c.term)));
  return terms
    .map((term) => ({ term, totals: sumCells(cells, (c) => c.term === term) }))
    .sort((a, b) => (a.totals.contribution - a.totals.spend) - (b.totals.contribution - b.totals.spend))[0];
}

const roasBelowBreakEven: AskDef = {
  id: "roas_below_breakeven", title: "Losing money on ads",
  precondition: (input) => lossStreak(input.history),
  build: (input) => {
    const cells = recentCells(input.history, LOSS_STREAK_DAYS);
    const t = sumCells(cells);
    const worst = worstKeyword(cells);
    const day = today(input);
    const reachGoal = ["Awareness-First", "Category-Creation"].includes(input.ctx.scenario.profile.goalType);
    return {
      id: "roas_below_breakeven", title: "Losing money on ads",
      line: `Your ads have lost money for ${LOSS_STREAK_DAYS} days in a row. They cost more than the profit from the orders they bring. Walk me through it.`,
      chips: [
        roasChip(`last ${LOSS_STREAK_DAYS} days`, t),
        { label: `Money lost on ads, last ${LOSS_STREAK_DAYS} days`, value: inr(t.spend - t.contribution), tone: "bad" },
        ...(worst && worst.totals.spend > 0 ? [{ label: `Worst keyword: "${worst.term}"`, value: `${fmtRoas(roas(worst.totals))} sales per ₹1`, tone: "bad" as ChipTone }] : []),
      ],
      options: [
        {
          id: "diagnose", label: worst ? `Stop "${worst.term}" and lower bids on keywords that lose money` : "Stop the keywords that lose money and lower bids",
          cost: "Fewer sales. You promise ads pay for themselves within 5 days.",
          effect: { relationshipDelta: 5 },
          quality: "strong",
          commitment: { text: `Ads earn back what they cost, day ${day} to day ${day + 4}`, kind: "covers_ad_spend", target: 0, fromDay: day, dueDay: day + 4, keptDelta: 6, brokenDelta: -6 },
        },
        {
          id: "investment", label: "It's worth it to reach new shoppers",
          cost: reachGoal ? "No change. Reaching new shoppers is this month's goal." : "No change. Your goal is profit, so the losses continue.",
          effect: { relationshipDelta: reachGoal ? 2 : -3 },
          quality: reachGoal ? "strong" : "weak",
        },
        {
          id: "wait", label: "Prices will settle. Give it a few days.",
          cost: "No change. You keep losing money meanwhile.",
          effect: { relationshipDelta: -4 },
          quality: "weak",
        },
      ],
    };
  },
};

// ── Library, picking and commitments ─────────────────────────────────────────

/** In priority order: urgent problems first, opportunities last. */
export const ROHIT_ASKS: readonly AskDef[] = [
  restock, roasBelowBreakEven, matchDiscount, sovThreat, newDarkStores, overstockClearance, cofundBanner,
];

export function askDef(id: AskId): AskDef | undefined {
  return ROHIT_ASKS.find((a) => a.id === id);
}

/** Asks whose preconditions hold right now (in priority order). */
export function eligibleAsks(input: RohitInput): readonly AskId[] {
  return ROHIT_ASKS.filter((a) => a.precondition(input)).map((a) => a.id);
}

/**
 * At most one ask for this check-in: the first eligible one not asked yet.
 * Null when nothing applies or the run's 3 check-ins are used up.
 */
export function pickCheckIns(input: RohitInput, alreadyAsked: readonly AskId[]): RohitAsk | null {
  if (alreadyAsked.length >= MAX_CHECKINS_PER_RUN) return null;
  const def = ROHIT_ASKS.find((a) => !alreadyAsked.includes(a.id) && a.precondition(input));
  return def ? def.build(input) : null;
}

/** True on a suggested check-in day while the run still has check-ins left. */
export function isCheckInDay(day: number, alreadyAsked: readonly AskId[]): boolean {
  return CHECK_IN_DAYS.includes(day) && alreadyAsked.length < MAX_CHECKINS_PER_RUN;
}

/** The commitment a reply creates, if any. */
export function commitmentFor(ask: RohitAsk, option: ReplyOption): Commitment | null {
  if (!option.commitment) return null;
  return { ...option.commitment, id: `${ask.id}:${option.id}:${option.commitment.fromDay}`, askId: ask.id };
}

export type CommitmentStatus = "pending" | "kept" | "broken";

export interface CommitmentResult {
  commitment: Commitment;
  status: CommitmentStatus;
  /** The measured value (OSA share, ₹, units, or contribution − spend). */
  actual: number;
}

function inWindow(history: readonly DayResult[], c: Commitment): readonly DayResult[] {
  return history.filter((d) => d.day >= c.fromDay && d.day <= c.dueDay);
}

function measure(c: Commitment, state: MarketState, history: readonly DayResult[]): number {
  const days = inWindow(history, c);
  const cells = days.flatMap((d) => d.cells);
  const matches = (x: { state: string; term: string; skuId: string }) =>
    (!c.state || x.state === c.state) && (!c.terms || c.terms.includes(x.term)) && (!c.skuIds || c.skuIds.includes(x.skuId));
  if (c.kind === "spend_at_least") return sumCells(cells, matches).spend;
  if (c.kind === "covers_ad_spend") {
    const t = sumCells(cells);
    return t.contribution - t.spend;
  }
  if (c.kind === "units_at_least") {
    return days.flatMap((d) => d.stock)
      .filter((r) => (!c.state || r.state === c.state) && (!c.skuIds || c.skuIds.includes(r.skuId)))
      .reduce((s, r) => s + r.adUnits + r.organicUnits, 0);
  }
  const due = history.find((d) => d.day === c.dueDay);
  const rows = (due?.stock ?? []).filter((r) => r.state === c.state && (!c.skuIds || c.skuIds.includes(r.skuId)));
  return rows.length ? Math.min(...rows.map((r) => r.osa)) : 0;
}

function isKept(c: Commitment, actual: number): boolean {
  return c.kind === "covers_ad_spend" ? actual >= 0 : actual >= c.target;
}

/** Marks each promise kept or broken once its due day has run; pending before. */
export function checkCommitments(
  commitments: readonly Commitment[],
  state: MarketState,
  history: readonly DayResult[] = [],
): readonly CommitmentResult[] {
  return commitments.map((c) => {
    const actual = measure(c, state, history);
    if (state.day < c.dueDay) return { commitment: c, status: "pending", actual };
    return { commitment: c, status: isKept(c, actual) ? "kept" : "broken", actual };
  });
}

/** Relationship change from resolved commitments. */
export function relationshipChange(results: readonly CommitmentResult[]): number {
  return results.reduce((s, r) => s + (r.status === "kept" ? r.commitment.keptDelta : r.status === "broken" ? r.commitment.brokenDelta : 0), 0);
}

export function clampRelationship(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export { lastDay };
