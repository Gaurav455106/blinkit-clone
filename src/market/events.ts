// ── Market events (SPEC §2 alert budget, §5 event library, §14 F12) ──────────
// Pure and deterministic. Events are evaluated after day D completes, for the
// day about to run (today = D + 1), so a student who reacts to an alert
// changes tomorrow's campaigns, exactly as on a real ads platform.
//
// Each event returns activations: effects as data (the engine applies them
// later; nothing here touches stepDay), an alert with the triggering number,
// whether it may pause the clock, and the levers that count as a right answer.
//
// Three sources:
// - calendar: sale day, IPL evening, payday, festival. Day ranges come in as
//   input so they can be wired to the calendar module later.
// - seeded: rain spike and rival stock-out, drawn from the batch + brand seed.
// - state: read from the latest DayResult history (stock, IS lost to budget,
//   pacing, rival rows).
//
// Rival conquest, newcomer launch and rival price cut are already simulated by
// rivals.ts (burst, activeFromDay, priceCut). Their effect here is empty on
// purpose (engineModelled: true): the event detects them for the alert and
// scoring, and must not be applied twice.

import type { CampaignConfig, CellRow, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import type { RivalData } from "@/market/types";
import { SLOT_LABELS } from "@/market/slots";
import { streamFor } from "@/market/rng";

// ── Types ────────────────────────────────────────────────────────────────────

/** Levers a student can pull; used to score responses later (SPEC §8). */
export type LeverId =
  | "raise_bid" | "lower_bid" | "pause_keyword" | "add_keyword" | "defend_brand_term"
  | "shift_to_long_tail" | "raise_budget" | "lower_budget" | "move_budget" | "daypart"
  | "add_state" | "remove_state" | "raise_state_budget" | "push_premium_sku"
  | "ask_rohit_restock" | "ask_rohit_cofund" | "split_campaign" | "hold";

export type CalendarEventId = "sale_day" | "ipl_evening" | "payday" | "festival";

/** One calendar entry (inclusive day range). Built by the calendar module. */
export interface CalendarEntry {
  id: CalendarEventId;
  fromDay: number;
  toDay: number;
  label?: string;
}

export type MarketEventId =
  | CalendarEventId
  | "rival_conquest" | "newcomer_launch" | "rival_price_cut" | "rival_stockout" | "rain_spike"
  | "stock_low" | "budget_capping" | "pacing";

export interface EventInput {
  ctx: MarketContext;
  /** State after the last completed day (state.day). */
  state: MarketState;
  /** Completed days, oldest first. */
  history: readonly DayResult[];
  /** The student's campaigns as they stand for tomorrow. */
  campaigns: readonly CampaignConfig[];
  calendar: readonly CalendarEntry[];
  /** Display names per campaign id (alerts fall back to the id). */
  campaignNames?: Readonly<Record<string, string>>;
}

/** Undefined filters mean "all". */
export interface DemandMod {
  mult: number;
  states?: readonly string[];
  /** Slot filter. A slot-only mod is an hour-profile shift (e.g. IPL 6–9 PM ×1.4). */
  slots?: readonly number[];
  /** Keyword terms or placement ids. */
  terms?: readonly string[];
}

export interface RivalBidMod {
  mult: number;
  /** Named rivals; undefined = every named rival. */
  rivalIds?: readonly string[];
  /** Apply to background bidders too (SPEC F12: sale day lifts both). */
  includeBackground: boolean;
  states?: readonly string[];
  terms?: readonly string[];
}

/** A rival out of every auction in these states (rival stock-out). */
export interface RivalExit {
  rivalId: string;
  states: readonly string[];
}

export interface CvrMod {
  mult: number;
  skuIds?: readonly string[];
  states?: readonly string[];
  terms?: readonly string[];
}

export interface EventEffect {
  demand?: readonly DemandMod[];
  rivalBids?: readonly RivalBidMod[];
  rivalExits?: readonly RivalExit[];
  cvr?: readonly CvrMod[];
}

export interface EventAlert {
  headline: string;
  /** One line with the data that triggered it. */
  detail: string;
}

export interface EventActivation {
  eventId: MarketEventId;
  /** Unique per occurrence; an active key never fires twice. */
  key: string;
  title: string;
  /** The state.day after which it was raised (alerts show then). */
  raisedAfterDay: number;
  /** First and last day the effect applies (inclusive). */
  startDay: number;
  endDay: number;
  decisionWindowDays: number;
  effect: EventEffect;
  alert: EventAlert;
  /** May pause the clock (still subject to the alert budget). */
  pauses: boolean;
  rightLevers: readonly LeverId[];
  /** Rough ₹ at stake over the decision window; ranks alerts, not a score. */
  stake: number;
  /** The numbers behind the alert, for chips and logs. */
  data: Readonly<Record<string, number | string>>;
}

export interface MarketEventDef {
  id: MarketEventId;
  title: string;
  source: "calendar" | "seeded" | "state";
  /** True when rivals.ts already simulates it, so `effect` is empty. */
  engineModelled: boolean;
  /** Days the effect lasts (calendar events use their entry's range). */
  expiresAfter: number;
  decisionWindowDays: number;
  pauses: boolean;
  rightLevers: readonly LeverId[];
  trigger: (input: EventInput) => readonly EventActivation[];
}

// ── Tunables ─────────────────────────────────────────────────────────────────

export const SALE_DEMAND_MULT = 1.6;
export const SALE_RIVAL_BID_MULT = 1.4;
export const IPL_EVENING_MULT = 1.4;
/** 6–9 PM (slots.ts). */
export const IPL_SLOT = 6;
export const IPL_CATEGORIES: readonly string[] = ["snacks", "protein"];
export const PAYDAY_PREMIUM_CVR = 1.1;
/** A SKU is premium when its MRP is at least this share of the brand's top MRP. */
export const PREMIUM_MRP_SHARE = 0.75;
export const FESTIVAL_DEMAND_MULT = 1.3;
export const FESTIVAL_RIVAL_BID_MULT = 1.2;
export const RAIN_DEMAND_MULT = 1.5;
export const METRO_STATES: readonly string[] = ["Maharashtra", "Delhi", "Karnataka", "Telangana", "Tamil Nadu", "West Bengal"];
export const STOCK_LOW_OSA = 0.3;
export const BUDGET_CAP_LOST_SHARE = 0.25;
export const CONQUEST_SOV = 0.15;
export const NEWCOMER_SHOCK_DAYS = 5;
const PACING_WINDOW_DAYS = 3;

/** SPEC §2: at most 1 pausing alert per day and about 8 per run. */
export const MAX_PAUSING_PER_DAY = 1;
export const MAX_PAUSING_PER_RUN = 8;

// ── Formatting ───────────────────────────────────────────────────────────────

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
const mult = (x: number) => `${x}×`;

// ── Shared metrics over the history (also used by rohit.ts) ─────────────────

export const today = (input: { state: MarketState }) => input.state.day + 1;
export const lastDay = (history: readonly DayResult[]): DayResult | undefined => history[history.length - 1];

export function isLiveOn(c: CampaignConfig, day: number, totalDays: number): boolean {
  return !c.paused && day >= c.launchDay && day <= (c.endDay ?? totalDays);
}

/** States the brand serves: stocked at the start of the run or stocked now. */
export function servedStates(ctx: MarketContext, state: MarketState): readonly string[] {
  const now = new Set(Object.values(state.stock).flatMap((bySku) => Object.keys(bySku).filter((s) => (bySku[s] ?? 0) > 0)));
  const start = Object.keys(ctx.scenario.cityStockMap).filter((s) => (ctx.scenario.cityStockMap[s as keyof typeof ctx.scenario.cityStockMap] ?? 0) > 0);
  return Array.from(new Set([...start, ...now]));
}

/** "sku|state" pairs live campaigns target tomorrow (Pan India = every served state). */
export function targetedPairs(input: Pick<EventInput, "ctx" | "state" | "campaigns">): ReadonlySet<string> {
  const day = today(input);
  const served = servedStates(input.ctx, input.state);
  const pairs = input.campaigns
    .filter((c) => isLiveOn(c, day, input.ctx.totalDays))
    .flatMap((c) => {
      const states = c.geography === "pan_india" ? served : c.cities;
      return c.skuIds.flatMap((sku) => states.map((s) => `${sku}|${s}`));
    });
  return new Set(pairs);
}

export function targetedStates(input: Pick<EventInput, "ctx" | "state" | "campaigns">): readonly string[] {
  return Array.from(new Set(Array.from(targetedPairs(input)).map((p) => p.split("|")[1])));
}

export interface CellTotals { spend: number; revenue: number; contribution: number; units: number; clicks: number; viewable: number; totalAdViewable: number; searches: number; won: number; lostToBudget: number }

export function sumCells(cells: readonly CellRow[], filter: (c: CellRow) => boolean = () => true): CellTotals {
  return cells.reduce<CellTotals>((t, c) => (filter(c) ? {
    spend: t.spend + c.spend,
    revenue: t.revenue + c.directRevenue + c.indirectRevenue,
    contribution: t.contribution + c.contribution,
    units: t.units + c.units,
    clicks: t.clicks + c.clicks,
    viewable: t.viewable + c.viewableImpressions,
    totalAdViewable: t.totalAdViewable + c.totalAdViewable,
    searches: t.searches + c.searches,
    won: t.won + c.won,
    lostToBudget: t.lostToBudget + c.lostToBudget,
  } : t), { spend: 0, revenue: 0, contribution: 0, units: 0, clicks: 0, viewable: 0, totalAdViewable: 0, searches: 0, won: 0, lostToBudget: 0 });
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

/** The category's busiest slot (its peak). */
export function peakSlot(ctx: MarketContext): number {
  const share = ctx.market.category.slotShare;
  return share.reduce((best, s, i) => (s > share[best] ? i : best), 0);
}

function rivalName(ctx: MarketContext, id: string): string {
  return ctx.market.rivals.find((r) => r.id === id)?.name ?? id;
}

function skuName(ctx: MarketContext, id: string): string {
  return ctx.scenario.profile.skus.find((s) => s.id === id)?.name ?? id;
}

function campaignName(input: EventInput, id: string): string {
  return input.campaignNames?.[id] ?? id;
}

// ── Building activations ─────────────────────────────────────────────────────

type ActivationFields = Pick<EventActivation, "key" | "alert" | "stake" | "data"> & Partial<Pick<EventActivation, "effect" | "startDay" | "endDay">>;

function activate(def: Omit<MarketEventDef, "trigger">, input: EventInput, fields: ActivationFields): EventActivation {
  const start = fields.startDay ?? today(input);
  return {
    eventId: def.id,
    title: def.title,
    raisedAfterDay: input.state.day,
    startDay: start,
    endDay: fields.endDay ?? start + def.expiresAfter - 1,
    decisionWindowDays: def.decisionWindowDays,
    effect: fields.effect ?? {},
    pauses: def.pauses,
    rightLevers: def.rightLevers,
    key: fields.key,
    alert: fields.alert,
    stake: Math.max(0, Math.round(fields.stake)),
    data: fields.data,
  };
}

function define(meta: Omit<MarketEventDef, "trigger">, trigger: (input: EventInput, meta: Omit<MarketEventDef, "trigger">) => readonly EventActivation[]): MarketEventDef {
  return { ...meta, trigger: (input) => trigger(input, meta) };
}

const yesterdayRevenue = (history: readonly DayResult[]) => sumCells(lastDay(history)?.cells ?? []).revenue;
const entriesStarting = (input: EventInput, id: CalendarEventId) => input.calendar.filter((e) => e.id === id && e.fromDay === today(input));
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

// ── Calendar events ──────────────────────────────────────────────────────────

const saleDay = define({
  id: "sale_day", title: "Big Savings Day", source: "calendar", engineModelled: false,
  expiresAfter: 1, decisionWindowDays: 1, pauses: true,
  rightLevers: ["raise_budget", "raise_bid", "daypart", "move_budget"],
}, (input, meta) => entriesStarting(input, "sale_day").map((e) => {
  const spentYesterday = sumCells(lastDay(input.history)?.cells ?? []).spend;
  const length = e.toDay - e.fromDay + 1;
  return activate(meta, input, {
    key: `sale_day|${e.fromDay}`, endDay: e.toDay,
    effect: {
      demand: [{ mult: SALE_DEMAND_MULT }],
      rivalBids: [{ mult: SALE_RIVAL_BID_MULT, includeBackground: true }],
    },
    alert: {
      headline: `${e.label ?? "Big Savings Day"} starts tomorrow`,
      detail: `Searches run about ${mult(SALE_DEMAND_MULT)} and rival bids about ${mult(SALE_RIVAL_BID_MULT)} for ${days(length)}. Yesterday you spent ${inr(spentYesterday)}; a 24/7 budget at that level can run dry before the evening.`,
    },
    stake: yesterdayRevenue(input.history) * (SALE_DEMAND_MULT - 1) * length,
    data: { demandMult: SALE_DEMAND_MULT, rivalBidMult: SALE_RIVAL_BID_MULT, spentYesterday, days: length },
  });
}));

const iplEvening = define({
  id: "ipl_evening", title: "IPL evenings", source: "calendar", engineModelled: false,
  expiresAfter: 1, decisionWindowDays: 2, pauses: false,
  rightLevers: ["daypart", "raise_bid", "move_budget"],
}, (input, meta) => {
  if (!IPL_CATEGORIES.includes(input.ctx.market.category.id)) return [];
  return entriesStarting(input, "ipl_evening").map((e) => {
    const cells = lastDay(input.history)?.cells ?? [];
    const eveningShare = ratio(sumCells(cells, (c) => c.slot === IPL_SLOT).spend, sumCells(cells).spend);
    return activate(meta, input, {
      key: `ipl_evening|${e.fromDay}`, endDay: e.toDay,
      effect: { demand: [{ mult: IPL_EVENING_MULT, slots: [IPL_SLOT] }] },
      alert: {
        headline: "IPL evenings start tomorrow",
        detail: `${SLOT_LABELS[IPL_SLOT]} searches run about ${mult(IPL_EVENING_MULT)} until day ${e.toDay}. Yesterday ${pct(eveningShare)} of your spend landed in ${SLOT_LABELS[IPL_SLOT]}.`,
      },
      stake: sumCells(cells, (c) => c.slot === IPL_SLOT).revenue * (IPL_EVENING_MULT - 1) * (e.toDay - e.fromDay + 1),
      data: { slot: IPL_SLOT, demandMult: IPL_EVENING_MULT, eveningSpendShare: eveningShare },
    });
  });
});

/** SKUs with an MRP near the brand's most expensive one. */
export function premiumSkuIds(ctx: MarketContext): readonly string[] {
  const skus = ctx.scenario.profile.skus;
  const top = Math.max(...skus.map((s) => s.mrp));
  return skus.filter((s) => s.mrp >= top * PREMIUM_MRP_SHARE).map((s) => s.id);
}

const payday = define({
  id: "payday", title: "Payday", source: "calendar", engineModelled: false,
  expiresAfter: 1, decisionWindowDays: 2, pauses: false,
  rightLevers: ["push_premium_sku", "move_budget"],
}, (input, meta) => entriesStarting(input, "payday").map((e) => {
  const premium = premiumSkuIds(input.ctx);
  const names = premium.map((id) => skuName(input.ctx, id)).join(", ");
  return activate(meta, input, {
    key: `payday|${e.fromDay}`, endDay: e.toDay,
    effect: { cvr: [{ mult: PAYDAY_PREMIUM_CVR, skuIds: premium }] },
    alert: {
      headline: "Payday starts tomorrow",
      detail: `Shoppers convert about ${pct(PAYDAY_PREMIUM_CVR - 1)} better on premium SKUs (${names}) until day ${e.toDay}.`,
    },
    stake: sumCells(lastDay(input.history)?.cells ?? [], (c) => premium.includes(c.skuId)).revenue * (PAYDAY_PREMIUM_CVR - 1) * (e.toDay - e.fromDay + 1),
    data: { cvrMult: PAYDAY_PREMIUM_CVR, premiumSkus: premium.join(",") },
  });
}));

const festival = define({
  id: "festival", title: "Festival", source: "calendar", engineModelled: false,
  expiresAfter: 1, decisionWindowDays: 2, pauses: true,
  rightLevers: ["raise_budget", "raise_bid", "move_budget"],
}, (input, meta) => entriesStarting(input, "festival").map((e) => activate(meta, input, {
  key: `festival|${e.fromDay}`, endDay: e.toDay,
  effect: {
    demand: [{ mult: FESTIVAL_DEMAND_MULT }],
    rivalBids: [{ mult: FESTIVAL_RIVAL_BID_MULT, includeBackground: true }],
  },
  alert: {
    headline: `${e.label ?? "Festival"} starts tomorrow`,
    detail: `Searches run about ${mult(FESTIVAL_DEMAND_MULT)} and rival bids about ${mult(FESTIVAL_RIVAL_BID_MULT)} until day ${e.toDay}.`,
  },
  stake: yesterdayRevenue(input.history) * (FESTIVAL_DEMAND_MULT - 1) * (e.toDay - e.fromDay + 1),
  data: { demandMult: FESTIVAL_DEMAND_MULT, rivalBidMult: FESTIVAL_RIVAL_BID_MULT },
})));

// ── Seeded events ────────────────────────────────────────────────────────────

export interface SeededOccurrence {
  state: string;
  day: number;
  days: number;
  rivalId?: string;
}

export interface SeededSchedule {
  rivalStockout: SeededOccurrence | null;
  rain: SeededOccurrence | null;
}

const pickFrom = <T,>(items: readonly T[], r: number): T => items[Math.min(items.length - 1, Math.floor(r * items.length))];
const dayIn = (from: number, to: number, r: number) => from + Math.floor(r * (to - from + 1));

/**
 * The seeded surprises for a run. Same batch + brand → same schedule.
 * Rival stock-out: a leader or challenger runs dry in one stocked state for
 * 2–3 days between days 10 and 22. Rain: one stocked metro state gets 1–2 days
 * of rain between days 5 and 25.
 */
export function seededSchedule(ctx: MarketContext): SeededSchedule {
  const stocked = Object.keys(ctx.scenario.cityStockMap).filter((s) => (ctx.scenario.cityStockMap[s as keyof typeof ctx.scenario.cityStockMap] ?? 0) > 0);
  const rivals = ctx.market.rivals.filter((r) => r.archetype === "leader" || r.archetype === "challenger");
  const so = streamFor(ctx.seed, "event", "rival_stockout");
  const rivalStockout = rivals.length && stocked.length
    ? { rivalId: pickFrom(rivals, so()).id, state: pickFrom(stocked, so()), day: dayIn(10, 22, so()), days: dayIn(2, 3, so()) }
    : null;
  const metros = stocked.filter((s) => METRO_STATES.includes(s));
  const rr = streamFor(ctx.seed, "event", "rain");
  const rain = metros.length ? { state: pickFrom(metros, rr()), day: dayIn(5, 25, rr()), days: dayIn(1, 2, rr()) } : null;
  return { rivalStockout, rain };
}

const rivalStockout = define({
  id: "rival_stockout", title: "Rival out of stock", source: "seeded", engineModelled: false,
  expiresAfter: 2, decisionWindowDays: 2, pauses: true,
  rightLevers: ["raise_state_budget", "raise_bid", "add_state"],
}, (input, meta) => {
  const occ = seededSchedule(input.ctx).rivalStockout;
  if (!occ || occ.day !== today(input) || !occ.rivalId) return [];
  const name = rivalName(input.ctx, occ.rivalId);
  const stateCells = lastDay(input.history)?.cells.filter((c) => c.state === occ.state) ?? [];
  const t = sumCells(stateCells);
  return [activate(meta, input, {
    key: `rival_stockout|${occ.rivalId}|${occ.state}|${occ.day}`, endDay: occ.day + occ.days - 1,
    effect: { rivalExits: [{ rivalId: occ.rivalId, states: [occ.state] }] },
    alert: {
      headline: `${name} is out of stock in ${occ.state}`,
      detail: `Its ads stop there for about ${days(occ.days)}, so clearing CPMs drop. Your share of ad views in ${occ.state} yesterday was ${pct(ratio(t.viewable, t.totalAdViewable))}.`,
    },
    stake: t.revenue * occ.days * 0.5,
    data: { rival: name, state: occ.state, days: occ.days, yourSov: ratio(t.viewable, t.totalAdViewable) },
  })];
});

const rainSpike = define({
  id: "rain_spike", title: "Rain spike", source: "seeded", engineModelled: false,
  expiresAfter: 1, decisionWindowDays: 1, pauses: false,
  rightLevers: ["raise_state_budget", "raise_budget"],
}, (input, meta) => {
  const occ = seededSchedule(input.ctx).rain;
  if (!occ || occ.day !== today(input)) return [];
  const stateRevenue = sumCells(lastDay(input.history)?.cells ?? [], (c) => c.state === occ.state).revenue;
  return [activate(meta, input, {
    key: `rain_spike|${occ.state}|${occ.day}`, endDay: occ.day + occ.days - 1,
    effect: { demand: [{ mult: RAIN_DEMAND_MULT, states: [occ.state] }] },
    alert: {
      headline: `Heavy rain forecast in ${occ.state}`,
      detail: `Searches there run about ${mult(RAIN_DEMAND_MULT)} for ${days(occ.days)}. You earned ${inr(stateRevenue)} in ${occ.state} yesterday.`,
    },
    stake: stateRevenue * (RAIN_DEMAND_MULT - 1) * occ.days,
    data: { state: occ.state, demandMult: RAIN_DEMAND_MULT, days: occ.days, stateRevenue },
  })];
});

// ── Rival moves already simulated by rivals.ts (detected for alerts) ─────────

interface RivalTermShare { rivalId: string; term: string; sov: number }

function rivalShares(day: DayResult | undefined, terms: readonly string[]): readonly RivalTermShare[] {
  if (!day) return [];
  return day.rivals
    .filter((r) => r.inventory === "keyword" && terms.includes(r.term))
    .map((r) => ({ rivalId: r.rivalId, term: r.term, sov: ratio(r.viewableImpressions, r.totalAdViewable) }));
}

const rivalConquest = define({
  id: "rival_conquest", title: "Rival bidding on your brand term", source: "state", engineModelled: true,
  expiresAfter: 5, decisionWindowDays: 3, pauses: true,
  rightLevers: ["defend_brand_term", "raise_bid", "add_keyword"],
}, (input, meta) => {
  const brandTerms = input.ctx.market.keywords.filter((k) => k.isBrandTerm).map((k) => k.term);
  const y = rivalShares(lastDay(input.history), brandTerms);
  const before = rivalShares(input.history[input.history.length - 2], brandTerms);
  return y
    .filter((s) => s.sov >= CONQUEST_SOV)
    .filter((s) => !before.some((b) => b.rivalId === s.rivalId && b.term === s.term && b.sov >= CONQUEST_SOV))
    .map((s) => {
      const name = rivalName(input.ctx, s.rivalId);
      const mine = sumCells(lastDay(input.history)?.cells ?? [], (c) => c.term === s.term);
      const yours = mine.totalAdViewable > 0 ? `; your share was ${pct(ratio(mine.viewable, mine.totalAdViewable))}` : "; you aren't bidding on it";
      const term = input.ctx.market.keywords.find((k) => k.term === s.term);
      return activate(meta, input, {
        key: `rival_conquest|${s.rivalId}|${s.term}`,
        alert: {
          headline: `${name} is bidding on "${s.term}"`,
          detail: `It took ${pct(s.sov)} of ad views on your brand term yesterday${yours}.`,
        },
        stake: Math.max(mine.revenue, (term?.dailyVolume ?? 0) * 0.02) * s.sov * meta.decisionWindowDays,
        data: { rival: name, term: s.term, rivalSov: s.sov, yourSov: ratio(mine.viewable, mine.totalAdViewable) },
      });
    });
});

const cpm = (t: CellTotals) => ratio(t.spend, t.viewable) * 1000;

const newcomerLaunch = define({
  id: "newcomer_launch", title: "Newcomer launch", source: "state", engineModelled: true,
  expiresAfter: NEWCOMER_SHOCK_DAYS, decisionWindowDays: 3, pauses: true,
  rightLevers: ["hold", "shift_to_long_tail", "lower_bid", "move_budget"],
}, (input, meta) => input.ctx.market.rivals
  .filter((r) => r.archetype === "newcomer" && (r.activeFromDay ?? 1) === input.state.day)
  .flatMap((r) => {
    const y = lastDay(input.history);
    const rows = y?.rivals.filter((row) => row.rivalId === r.id && row.inventory === "keyword") ?? [];
    if (rows.reduce((s, row) => s + row.appearances, 0) <= 0) return [];
    const terms = Object.keys(r.bids);
    const sov = ratio(rows.reduce((s, row) => s + row.viewableImpressions, 0), rows.reduce((s, row) => s + row.totalAdViewable, 0));
    const onTerms = (c: CellRow) => terms.includes(c.term);
    const cpmBefore = cpm(sumCells(input.history[input.history.length - 2]?.cells ?? [], onTerms));
    const cpmNow = cpm(sumCells(y?.cells ?? [], onTerms));
    const cpmLine = cpmBefore > 0 && cpmNow > 0 ? ` Your CPM on its terms went from ${inr(cpmBefore)} to ${inr(cpmNow)}.` : "";
    return [activate(meta, input, {
      key: `newcomer_launch|${r.id}`,
      alert: {
        headline: `${r.name} launched on ${terms.slice(0, 2).join(", ")}`,
        detail: `It took ${pct(sov)} of ad views on its terms on day one.${cpmLine}`,
      },
      stake: sumCells(y?.cells ?? [], onTerms).spend * meta.decisionWindowDays * 0.3,
      data: { rival: r.name, rivalSov: sov, cpmBefore, cpmNow },
    })];
  }));

const rivalPriceCut = define({
  id: "rival_price_cut", title: "Rival price cut", source: "state", engineModelled: true,
  expiresAfter: 7, decisionWindowDays: 3, pauses: true,
  rightLevers: ["shift_to_long_tail", "move_budget", "ask_rohit_cofund"],
}, (input, meta) => input.ctx.market.rivals
  .filter((r): r is RivalData & { priceCut: { day: number; pct: number } } => !!r.priceCut && r.priceCut.day === input.state.day)
  .map((r) => {
    const shared = (c: CellRow) => c.inventory === "keyword" && r.bids[c.term] !== undefined;
    const before = sumCells(input.history[input.history.length - 2]?.cells ?? [], shared);
    const after = sumCells(lastDay(input.history)?.cells ?? [], shared);
    const newPrice = r.price * (1 - r.priceCut.pct);
    const cvrLine = before.clicks > 0 && after.clicks > 0
      ? ` Your CVR on shared terms went from ${pct(ratio(before.units, before.clicks))} to ${pct(ratio(after.units, after.clicks))}.`
      : "";
    return activate(meta, input, {
      key: `rival_price_cut|${r.id}`,
      alert: {
        headline: `${r.name} cut its price ${pct(r.priceCut.pct)}`,
        detail: `Now ${inr(newPrice)}, down from ${inr(r.price)}.${cvrLine}`,
      },
      stake: after.revenue * r.priceCut.pct * meta.decisionWindowDays * 2,
      data: { rival: r.name, cutPct: r.priceCut.pct, oldPrice: r.price, newPrice, cvrBefore: ratio(before.units, before.clicks), cvrAfter: ratio(after.units, after.clicks) },
    });
  }));

// ── State-triggered events ───────────────────────────────────────────────────

const stockLow = define({
  id: "stock_low", title: "Your stock running low", source: "state", engineModelled: false,
  expiresAfter: 3, decisionWindowDays: 2, pauses: true,
  rightLevers: ["lower_bid", "ask_rohit_restock", "remove_state", "move_budget"],
}, (input, meta) => {
  const y = lastDay(input.history);
  if (!y) return [];
  const targeted = targetedPairs(input);
  return y.stock
    .filter((r) => r.osa > 0 && r.osa < STOCK_LOW_OSA && targeted.has(`${r.skuId}|${r.state}`))
    .map((r) => {
      const daily = r.adUnits + r.organicUnits;
      const cover = ratio(r.closing, daily);
      const revenue = sumCells(y.cells, (c) => c.skuId === r.skuId && c.state === r.state).revenue;
      return activate(meta, input, {
        key: `stock_low|${r.skuId}|${r.state}`,
        alert: {
          headline: `${skuName(input.ctx, r.skuId)} is running low in ${r.state}`,
          detail: `OSA fell to ${pct(r.osa)} yesterday (${Math.round(r.closing)} units, about ${cover.toFixed(1)} days of cover). Ads stop where stock runs out.`,
        },
        stake: revenue * meta.decisionWindowDays,
        data: { skuId: r.skuId, state: r.state, osa: r.osa, units: r.closing, daysCover: cover },
      });
    });
});

const budgetCapping = define({
  id: "budget_capping", title: "Budget capping before peak", source: "state", engineModelled: false,
  expiresAfter: 3, decisionWindowDays: 3, pauses: true,
  rightLevers: ["raise_budget", "daypart", "move_budget"],
}, (input, meta) => {
  if (input.history.length < 2) return [];
  const peak = peakSlot(input.ctx);
  const [d1, d2] = input.history.slice(-2);
  const ids = Array.from(new Set(d2.cells.map((c) => c.campaignId)));
  return ids.flatMap((id) => {
    const inPeak = (c: CellRow) => c.campaignId === id && c.slot === peak;
    const a = sumCells(d1.cells, inPeak);
    const b = sumCells(d2.cells, inPeak);
    const shareA = ratio(a.lostToBudget, a.searches);
    const shareB = ratio(b.lostToBudget, b.searches);
    if (shareA <= BUDGET_CAP_LOST_SHARE || shareB <= BUDGET_CAP_LOST_SHARE) return [];
    const valuePerWon = ratio(b.revenue, b.won);
    return [activate(meta, input, {
      key: `budget_capping|${id}`,
      alert: {
        headline: `${campaignName(input, id)} runs out of budget before the ${SLOT_LABELS[peak]} peak`,
        detail: `IS lost to budget in ${SLOT_LABELS[peak]} was ${pct(shareA)} and ${pct(shareB)} the last two days.`,
      },
      stake: b.lostToBudget * valuePerWon * meta.decisionWindowDays,
      data: { campaignId: id, slot: peak, lostShareDay1: shareA, lostShareDay2: shareB },
    })];
  });
});

interface PacingTarget { key: string; label: string; budget: number; spent: number; avgDaily: number; endDay: number }

function pacingTargets(input: EventInput): readonly PacingTarget[] {
  const recent = input.history.slice(-PACING_WINDOW_DAYS);
  if (recent.length < 2) return [];
  const avgOf = (filter: (c: CellRow) => boolean) => recent.reduce((s, d) => s + sumCells(d.cells, filter).spend, 0) / recent.length;
  const account: PacingTarget = {
    key: "pacing|account", label: `the ${inr(input.ctx.scenario.budget)} budget`,
    budget: input.ctx.scenario.budget, spent: input.state.totalSpend, avgDaily: avgOf(() => true), endDay: input.ctx.totalDays,
  };
  const overall = input.campaigns
    .filter((c) => c.budgetType === "overall" && isLiveOn(c, today(input), input.ctx.totalDays))
    .map((c) => ({
      key: `pacing|${c.id}`, label: `${campaignName(input, c.id)}'s ${inr(c.budget)} budget`,
      budget: c.budget, spent: input.state.campaignSpend[c.id] ?? 0, avgDaily: avgOf((cell) => cell.campaignId === c.id), endDay: c.endDay ?? input.ctx.totalDays,
    }));
  return [account, ...overall];
}

/** Last day the remaining budget covers at the recent daily rate. */
export function projectedRunOutDay(spent: number, budget: number, avgDaily: number, lastCompletedDay: number): number {
  if (avgDaily <= 0) return Infinity;
  return lastCompletedDay + Math.floor(Math.max(0, budget - spent) / avgDaily);
}

const pacing = define({
  id: "pacing", title: "Budget runs out before day 30", source: "state", engineModelled: false,
  expiresAfter: 3, decisionWindowDays: 3, pauses: true,
  rightLevers: ["lower_budget", "lower_bid", "pause_keyword", "daypart"],
}, (input, meta) => pacingTargets(input).flatMap((t) => {
  const runOut = projectedRunOutDay(t.spent, t.budget, t.avgDaily, input.state.day);
  if (runOut >= t.endDay) return [];
  const early = t.endDay - runOut;
  const avgRevenue = input.history.slice(-PACING_WINDOW_DAYS).reduce((s, d) => s + sumCells(d.cells).revenue, 0) / Math.min(PACING_WINDOW_DAYS, input.history.length);
  return [activate(meta, input, {
    key: t.key,
    alert: {
      headline: `Budget runs out on day ${runOut}`,
      detail: `At ${inr(t.avgDaily)} a day (${PACING_WINDOW_DAYS}-day average), ${t.label} runs out ${days(early)} early. Spent so far: ${inr(t.spent)}.`,
    },
    stake: avgRevenue * early * 0.25,
    data: { runOutDay: runOut, avgDaily: t.avgDaily, spent: t.spent, budget: t.budget, daysEarly: early },
  })];
}));

// ── Library and evaluation ───────────────────────────────────────────────────

export const MARKET_EVENTS: readonly MarketEventDef[] = [
  saleDay, iplEvening, payday, festival,
  rivalStockout, rainSpike,
  rivalConquest, newcomerLaunch, rivalPriceCut,
  stockLow, budgetCapping, pacing,
];

export function eventDef(id: MarketEventId): MarketEventDef | undefined {
  return MARKET_EVENTS.find((d) => d.id === id);
}

export function isActiveOn(a: EventActivation, day: number): boolean {
  return day >= a.startDay && day <= a.endDay;
}

export function activeOn(activations: readonly EventActivation[], day: number): readonly EventActivation[] {
  return activations.filter((a) => isActiveOn(a, day));
}

/**
 * New activations for tomorrow. `existing` is every activation raised so far;
 * a key that is still active (or a one-off calendar/seeded key) never fires twice.
 */
export function evaluateEvents(input: EventInput, existing: readonly EventActivation[] = []): readonly EventActivation[] {
  const day = today(input);
  const blocked = new Set(existing.filter((a) => a.endDay >= day).map((a) => a.key));
  return MARKET_EVENTS
    .flatMap((def) => def.trigger(input))
    .filter((a) => !blocked.has(a.key));
}

// ── Effect lookups for the engine (wire into stepDay later) ─────────────────

const matches = (filter: readonly (string | number)[] | undefined, value: string | number) => !filter || filter.includes(value);

/** Demand multipliers for one keyword/placement × state × slot; feed into DemandContext.eventMults (capped by EVENT_CAP). */
export function demandMults(activations: readonly EventActivation[], day: number, state: string, slot: number, term: string): readonly number[] {
  return activeOn(activations, day)
    .flatMap((a) => a.effect.demand ?? [])
    .filter((m) => matches(m.states, state) && matches(m.slots, slot) && matches(m.terms, term))
    .map((m) => m.mult);
}

/** Bid multiplier for a named rival (rivalId) or a background bidder (null). */
export function rivalBidMult(activations: readonly EventActivation[], day: number, rivalId: string | null, state: string, term: string): number {
  return activeOn(activations, day)
    .flatMap((a) => a.effect.rivalBids ?? [])
    .filter((m) => (rivalId === null ? m.includeBackground : matches(m.rivalIds, rivalId)) && matches(m.states, state) && matches(m.terms, term))
    .reduce((p, m) => p * m.mult, 1);
}

export function rivalExited(activations: readonly EventActivation[], day: number, rivalId: string, state: string): boolean {
  return activeOn(activations, day).some((a) => (a.effect.rivalExits ?? []).some((x) => x.rivalId === rivalId && x.states.includes(state)));
}

export function cvrMult(activations: readonly EventActivation[], day: number, skuId: string, state: string, term: string): number {
  return activeOn(activations, day)
    .flatMap((a) => a.effect.cvr ?? [])
    .filter((m) => matches(m.skuIds, skuId) && matches(m.states, state) && matches(m.terms, term))
    .reduce((p, m) => p * m.mult, 1);
}

// ── Alert budget (SPEC §2) ───────────────────────────────────────────────────

export interface AlertSelection {
  /** The one alert that pauses the clock, or null. */
  pausing: EventActivation | null;
  /** Everything else, for the alerts feed, highest stake first. */
  feed: readonly EventActivation[];
}

/**
 * Picks at most one pausing alert, by ₹ at stake, while the day and run
 * budgets allow (1 per day, 8 per run). Everything else goes to the feed.
 */
export function selectAlerts(
  candidates: readonly EventActivation[],
  alreadyShownToday: number,
  shownThisRun: number,
): AlertSelection {
  const sorted = [...candidates].sort((a, b) => b.stake - a.stake);
  const canPause = alreadyShownToday < MAX_PAUSING_PER_DAY && shownThisRun < MAX_PAUSING_PER_RUN;
  const pausing = canPause ? sorted.find((a) => a.pauses) ?? null : null;
  return { pausing, feed: sorted.filter((a) => a !== pausing) };
}
