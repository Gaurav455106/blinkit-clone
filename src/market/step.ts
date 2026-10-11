// ── stepDay: one simulated day (SPEC §2, §3, §14 F1–F8, F11) ──────────────────
// Pure: (context, yesterday's state, today's campaigns) → (new state, day result).
// Changes a student makes apply simply by passing new campaigns next day.
//
// Pacing (F5): slots run in time order. Each slot is split into quarters; a
// campaign that can't afford a quarter gets a pro-rata share of it and sits
// out the rest of the day, so spend never exceeds its cap.
//
// Approximation: the student enters a page only in the OSA share of searches;
// rivals' results use the with-student auction for the whole page.

import { BLINKIT_STATES, CITY_STORE_COUNT } from "@/data/scenarios";
import type { CampaignConfig, CellRow, DayResult, MarketContext, MarketState, RivalDayRow, StockRow } from "@/market/engineTypes";
import type { InventoryKind } from "@/market/types";
import { SLOT_COUNT } from "@/market/types";
import { VIEW_RATES_BY_KIND, CREATIVE_KINDS } from "@/market/placements";
import { keywordCompetition, PLACEMENT_COMPETITION } from "@/market/competition";
import { activeSlots } from "@/market/slots";
import { searches, stateShares, seasonDemandMult, DOW_MULT, type DemandContext } from "@/market/demand";
import { runAuction, backgroundBidders, type Bidder, type SlotResult } from "@/market/auction";
import { streamFor } from "@/market/rng";
import { studentEntries, placementEntries, type StudentEntry } from "@/market/entries";
import { rivalBid, rivalPrice, updateRival } from "@/market/rivals";
import { shopperOutcome, priceEffect, affinity, fatigueMult } from "@/market/shoppers";
import { osa, organicDemand, sellFrom, isRestockDay, restockAmount } from "@/market/stock";
import { activeOn, demandMults, rivalBidMult, rivalExited, cvrMult, type EventActivation } from "@/market/events";
import { EMPTY_ADJUSTMENTS, extraSpendOn, priceCutFor, shelfMult, stockAddsOn, type Adjustments } from "@/market/adjustments";

/** Market events active in the run and the effects of Rohit's replies (both optional). */
export interface StepOptions {
  events?: readonly EventActivation[];
  adjustments?: Adjustments;
}

/** Yesterday's closing stock plus any stock Rohit's replies deliver today. */
function withStockAdds(prev: MarketState, adj: Adjustments, day: number): MarketState {
  const adds = stockAddsOn(adj, day);
  if (adds.length === 0) return prev;
  const stock: Record<string, Record<string, number>> = Object.fromEntries(Object.entries(prev.stock).map(([sku, bySt]) => [sku, { ...bySt }]));
  for (const a of adds) stock[a.skuId] = { ...(stock[a.skuId] ?? {}), [a.state]: (stock[a.skuId]?.[a.state] ?? 0) + a.units };
  return { ...prev, stock };
}

const QUARTERS_PER_SLOT = 4;
/** Active shoppers per dark store (reach and frequency, SPEC §14 F7, F10). */
const SHOPPERS_PER_STORE = 1500;
const CTR_WINDOW_DAYS = 3;
const SALES_WINDOW_DAYS = 7;
const RIVAL_WINDOW_DAYS = 3;
const STUDENT_OWNER = "student";

function isLive(c: CampaignConfig, day: number, totalDays: number): boolean {
  return !c.paused && day >= c.launchDay && day <= (c.endDay ?? totalDays);
}

/** A busy day may spend up to this multiple of the daily budget (SPEC §3.3.2). */
export const MAX_DAILY_FLEX = 1.5;
const WEEK_DAYS = 7;

const weekOf = (day: number) => Math.floor((day - 1) / WEEK_DAYS);

/** Today's expected traffic relative to the average day of its week (1 = average). */
export function trafficIndex(ctx: MarketContext, day: number): number {
  const dow = (d: number) => DOW_MULT[(ctx.startWeekday + d - 1) % WEEK_DAYS];
  const start = weekOf(day) * WEEK_DAYS + 1;
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => start + i).filter((d) => d <= ctx.totalDays);
  return dow(day) / (days.reduce((s, d) => s + dow(d), 0) / days.length);
}

/**
 * Today's spend limit. Budgets flex with traffic: busy days may spend up to
 * 1.5× the daily amount and quiet days less. Daily budgets are normalised per
 * week (never more than budget × live days in the week), so the run never
 * passes budget × days. Overall budgets flex the same way within what's left.
 */
function dailyCap(c: CampaignConfig, prev: MarketState, day: number, ctx: MarketContext): number {
  const flex = Math.min(MAX_DAILY_FLEX, trafficIndex(ctx, day));
  const endDay = c.endDay ?? ctx.totalDays;
  if (c.budgetType === "daily") {
    const weekStart = weekOf(day) * WEEK_DAYS + 1;
    const weekEnd = Math.min(weekStart + WEEK_DAYS - 1, endDay);
    const liveDays = Math.max(0, weekEnd - Math.max(weekStart, c.launchDay) + 1);
    const tracked = prev.campaignWeekSpend[c.id];
    const spentThisWeek = tracked && tracked.week === weekOf(day) ? tracked.spent : 0;
    return Math.max(0, Math.min(c.budget * flex, c.budget * liveDays - spentThisWeek));
  }
  const remaining = Math.max(0, c.budget - (prev.campaignSpend[c.id] ?? 0));
  const daysLeft = Math.max(1, endDay - day + 1);
  return Math.min(remaining, (remaining / daysLeft) * flex);
}

/** States the brand serves: stocked at the start of the run, or stocked now. */
function servedStates(ctx: MarketContext, prev: MarketState): Set<string> {
  return new Set(BLINKIT_STATES.filter((s) =>
    (ctx.scenario.cityStockMap[s] ?? 0) > 0 ||
    Object.values(prev.stock).some((bySku) => (bySku[s] ?? 0) > 0)));
}

const pushWindow = (xs: readonly number[] | undefined, x: number, size: number) => [...(xs ?? []), x].slice(-size);
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
const studentBidderId = (e: StudentEntry) => `${STUDENT_OWNER}:${e.campaignId}:${e.matchType}`;

/** A keyword or a placement: something with pages to win. */
interface InventoryUnit {
  id: string;
  kind: InventoryKind;
  dailyVolume: number;
  isBrandTerm: boolean;
  ctrMult: number;
  cvrMult: number;
  /** Scales background "other brands" bids. */
  competition: number;
}

interface Page {
  unit: InventoryUnit;
  state: string;
  searches: number;
  viewRates: readonly number[];
  others: Bidder[];
  entries: StudentEntry[];
}

/** Share of a state's shoppers the student has reached, and how often each has seen the ads. */
function reachAndFrequency(cumulativeViewable: number, stateName: string): { reachShare: number; frequency: number } {
  const stores = CITY_STORE_COUNT[stateName as keyof typeof CITY_STORE_COUNT] ?? 0;
  const shoppers = stores * SHOPPERS_PER_STORE;
  if (shoppers <= 0 || cumulativeViewable <= 0) return { reachShare: 0, frequency: 0 };
  const reachShare = 1 - Math.exp(-cumulativeViewable / shoppers);
  return { reachShare, frequency: cumulativeViewable / (shoppers * reachShare) };
}

type MutableCell = { -readonly [K in keyof CellRow]: CellRow[K] };
type MutableRivalRow = { -readonly [K in keyof RivalDayRow]: RivalDayRow[K] };

function resolve(pages: readonly Page[], active: ReadonlySet<string>): SlotResult[][] {
  return pages.map((p) => runAuction([
    ...p.others,
    ...p.entries
      .filter((e) => active.has(e.campaignId))
      .map((e) => ({ id: studentBidderId(e), ownerId: STUDENT_OWNER, bid: e.bid, relevance: e.relevance })),
  ], p.viewRates));
}

export function stepDay(
  ctx: MarketContext,
  yesterday: MarketState,
  campaigns: readonly CampaignConfig[],
  opts: StepOptions = {},
): { state: MarketState; result: DayResult } {
  const day = yesterday.day + 1;
  const adj = opts.adjustments ?? EMPTY_ADJUSTMENTS;
  const events = activeOn(opts.events ?? [], day);
  const prev = withStockAdds(yesterday, adj, day);
  const extraSpend = extraSpendOn(adj, day);
  const shelf = shelfMult(adj, day);
  const { scenario, market } = ctx;
  const cat = market.category;
  const weekday = (ctx.startWeekday + day - 1) % 7;
  const seasonMult = seasonDemandMult(scenario.season.name, cat.id);
  const dctx: DemandContext = { seed: ctx.seed, day, weekday, seasonMult, eventMults: [] };
  const live = campaigns.filter((c) => isLive(c, day, ctx.totalDays));
  const served = servedStates(ctx, prev);
  const skuById = new Map(scenario.profile.skus.map((s) => [s.id, s]));
  const rivalById = new Map(market.rivals.map((r) => [r.id, r]));
  const campaignById = new Map(live.map((c) => [c.id, c]));
  const units: InventoryUnit[] = [
    ...market.keywords.map((k) => ({
      id: k.term, kind: "keyword" as const, dailyVolume: k.dailyVolume, isBrandTerm: k.isBrandTerm === true,
      ctrMult: 1, cvrMult: 1, competition: keywordCompetition(k.tier, k.isBrandTerm === true),
    })),
    ...market.placements.map((p) => ({
      id: p.id, kind: p.kind, dailyVolume: p.dailyVolume, isBrandTerm: false,
      ctrMult: p.ctrMult, cvrMult: p.cvrMult, competition: PLACEMENT_COMPETITION,
    })),
  ];
  const keywordById = new Map(market.keywords.map((k) => [k.term, k]));
  const placementById = new Map(market.placements.map((p) => [p.id, p]));

  // Daily caps, scaled down if they'd pass the scenario budget
  const caps = live.map((c) => [c.id, dailyCap(c, prev, day, ctx)] as const);
  const allowed = Math.max(0, scenario.budget - prev.totalSpend - extraSpend);
  const capTotal = caps.reduce((s, [, v]) => s + v, 0);
  const capScale = capTotal > allowed ? allowed / capTotal : 1;
  const remaining = new Map(caps.map(([id, v]) => [id, v * capScale]));

  const cells = new Map<string, MutableCell>();
  const rivalRows = new Map<string, MutableRivalRow>();
  const termTotalVI = new Map<string, number>();
  const stateStudentVI = new Map<string, number>();
  const stateTotalVI = new Map<string, number>();

  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const scheduled = live.filter((c) => activeSlots(c.schedule).includes(slot));
    const pages: Page[] = [];
    for (const unit of units) {
      for (const st of BLINKIT_STATES) {
        const pageDemand = events.length ? { ...dctx, eventMults: demandMults(events, day, st, slot, unit.id) } : dctx;
        const n = searches(market, { term: unit.id, dailyVolume: unit.dailyVolume }, st, slot, pageDemand);
        if (n === 0) continue;
        const rivals = market.rivals.flatMap((r) => {
          if (events.length && rivalExited(events, day, r.id, st)) return [];
          const bid = rivalBid(r, prev.rivals[r.id], unit.id, day, cat.rivalPressure[slot]);
          const lift = events.length ? rivalBidMult(events, day, r.id, st, unit.id) : 1;
          return bid === null ? [] : [{ id: `rival:${r.id}`, ownerId: r.id, bid: bid * lift, relevance: r.relevance }];
        });
        const bgLift = events.length ? rivalBidMult(events, day, null, st, unit.id) : 1;
        const bg = backgroundBidders(cat, cat.rivalPressure[slot], streamFor(ctx.seed, "bg", unit.id, st, slot, day), unit.competition * bgLift);
        const rawEntries = !served.has(st) ? []
          : unit.kind === "keyword" ? studentEntries(scheduled, keywordById.get(unit.id)!, st, market, scenario, prev)
          : placementEntries(scheduled, placementById.get(unit.id)!, st, market, scenario, prev);
        const entries = shelf === 1 ? rawEntries : rawEntries.map((e) => ({ ...e, relevance: e.relevance * shelf }));
        pages.push({ unit, state: st, searches: n, viewRates: VIEW_RATES_BY_KIND[unit.kind], others: [...rivals, ...bg], entries });
      }
    }

    const active = new Set(scheduled.filter((c) => (remaining.get(c.id) ?? 0) > 0).map((c) => c.id));
    let outcomes = resolve(pages, active);

    for (let q = 0; q < QUARTERS_PER_SLOT; q++) {
      // What each active campaign would spend in this quarter
      const cost = new Map<string, number>();
      pages.forEach((p, i) => {
        for (const w of outcomes[i]) {
          const e = p.entries.find((x) => studentBidderId(x) === w.bidderId);
          if (!e) continue;
          const spend = (p.searches / QUARTERS_PER_SLOT) * e.osa * w.viewRate * w.price / 1000;
          cost.set(e.campaignId, (cost.get(e.campaignId) ?? 0) + spend);
        }
      });
      const share = new Map<string, number>();
      for (const id of active) {
        const c = cost.get(id) ?? 0;
        const rem = remaining.get(id) ?? 0;
        share.set(id, c <= rem ? 1 : rem / c);
      }

      pages.forEach((p, i) => {
        const sq = p.searches / QUARTERS_PER_SLOT;
        const winners = outcomes[i];
        const pageVI = winners.reduce((s, w) => s + sq * w.viewRate, 0);
        termTotalVI.set(p.unit.id, (termTotalVI.get(p.unit.id) ?? 0) + pageVI);
        stateTotalVI.set(p.state, (stateTotalVI.get(p.state) ?? 0) + pageVI);
        const rivalPricesOnPage = winners
          .filter((w) => rivalById.has(w.ownerId))
          .map((w) => rivalPrice(rivalById.get(w.ownerId)!, day));

        for (const w of winners) {
          const r = rivalById.get(w.ownerId);
          if (!r) continue;
          const vi = sq * w.viewRate;
          const out = shopperOutcome({
            viewableImpressions: vi, baseCTR: cat.baseCTR * p.unit.ctrMult, creativeMult: 1, affinity: 1, fatigueMult: 1,
            baseCVR: cat.baseCVR * p.unit.cvrMult, fit: 1, intent: cat.intent[slot], stateCVR: 1, priceEffect: 1,
            sellingPrice: rivalPrice(r, day), contributionPerUnit: r.contributionPerUnit,
          });
          const key = `${r.id}|${p.unit.id}`;
          const row = rivalRows.get(key) ?? { rivalId: r.id, inventory: p.unit.kind, term: p.unit.id, viewableImpressions: 0, totalAdViewable: 0, topSlotWins: 0, appearances: 0, spend: 0, revenue: 0 };
          row.viewableImpressions += vi;
          row.totalAdViewable += pageVI;
          row.topSlotWins += w.slot === 0 ? sq : 0;
          row.appearances += sq;
          row.spend += vi * w.price / 1000;
          row.revenue += out.revenue;
          rivalRows.set(key, row);
        }

        for (const e of p.entries) {
          const key = `${e.campaignId}|${p.unit.id}|${e.matchType}|${p.state}|${slot}`;
          const cell = cells.get(key) ?? {
            campaignId: e.campaignId, inventory: p.unit.kind, term: p.unit.id, matchType: e.matchType, skuId: e.skuId, state: p.state, slot,
            searches: 0, lostToStock: 0, lostToBudget: 0, lostToRank: 0, won: 0, position: null,
            viewableImpressions: 0, totalAdViewable: 0, spend: 0, clicks: 0, atcs: 0, units: 0,
            directRevenue: 0, indirectRevenue: 0, contribution: 0,
          };
          const eligible = sq * e.osa;
          const f = active.has(e.campaignId) ? share.get(e.campaignId) ?? 0 : 0;
          const entered = eligible * f;
          const win = winners.find((w) => w.bidderId === studentBidderId(e));
          cell.searches += sq;
          cell.lostToStock += sq - eligible;
          cell.lostToBudget += eligible - entered;
          cell.totalAdViewable += pageVI;
          if (!win) {
            cell.lostToRank += entered;
          } else if (entered > 0) {
            const sku = skuById.get(e.skuId)!;
            const vi = entered * win.viewRate;
            const { reachShare, frequency } = reachAndFrequency(prev.studentViewable[p.state] ?? 0, p.state);
            const cheapest = rivalPricesOnPage.length ? Math.min(...rivalPricesOnPage) : null;
            // Creative-led formats build reach and tire; search-led formats benefit from that reach.
            const creativeLed = CREATIVE_KINDS.has(p.unit.kind);
            const cut = priceCutFor(adj, day, e.skuId);
            const price = sku.mrp * (1 - cut.pct);
            const eventCvr = events.length ? cvrMult(events, day, e.skuId, p.state, p.unit.id) : 1;
            const out = shopperOutcome({
              viewableImpressions: vi, baseCTR: cat.baseCTR * p.unit.ctrMult,
              creativeMult: creativeLed ? campaignById.get(e.campaignId)?.creativeMult ?? 1 : 1,
              affinity: creativeLed ? 1 : affinity(p.unit.isBrandTerm, reachShare),
              fatigueMult: creativeLed ? fatigueMult(frequency) : 1,
              baseCVR: cat.baseCVR * p.unit.cvrMult, fit: e.fit, intent: cat.intent[slot],
              stateCVR: (market.stateCVR[p.state as keyof typeof market.stateCVR] ?? 1) * eventCvr,
              priceEffect: priceEffect(price, cheapest),
              sellingPrice: price, contributionPerUnit: sku.margin - cut.marginGivenUp,
            });
            cell.won += entered;
            cell.position = cell.position === null ? win.slot : Math.min(cell.position, win.slot);
            cell.viewableImpressions += vi;
            cell.spend += vi * win.price / 1000;
            cell.clicks += out.clicks;
            cell.atcs += out.atcs;
            cell.units += out.units;
            cell.directRevenue += out.directRevenue;
            cell.indirectRevenue += out.indirectRevenue;
            cell.contribution += out.contribution;
            stateStudentVI.set(p.state, (stateStudentVI.get(p.state) ?? 0) + vi);
          }
          cells.set(key, cell);
        }
      });

      // Spend the quarter; campaigns that ran out leave the auction for the rest of the day
      let capped = false;
      for (const id of active) {
        const f = share.get(id) ?? 1;
        remaining.set(id, Math.max(0, (remaining.get(id) ?? 0) - (cost.get(id) ?? 0) * f));
        if (f < 1) { active.delete(id); capped = true; }
      }
      if (capped && q < QUARTERS_PER_SLOT - 1) outcomes = resolve(pages, active);
    }
  }

  const { stockRows, nextStock, nextSales, unitRatio } = settleStock(ctx, prev, cells, stateStudentVI, stateTotalVI, day, weekday, seasonMult);
  const finalCells: CellRow[] = [...cells.values()].map((c) => {
    const ratio = unitRatio.get(`${c.skuId}|${c.state}`) ?? 1;
    return ratio === 1 ? { ...c } : {
      ...c,
      atcs: c.atcs * ratio, units: c.units * ratio, directRevenue: c.directRevenue * ratio,
      indirectRevenue: c.indirectRevenue * ratio, contribution: c.contribution * ratio,
    };
  });

  const settled = nextState(ctx, prev, day, finalCells, [...rivalRows.values()], termTotalVI, nextStock, nextSales);
  const state = extraSpend > 0 ? { ...settled, totalSpend: settled.totalSpend + extraSpend } : settled;
  return { state, result: { day, cells: finalCells, rivals: [...rivalRows.values()].map((r) => ({ ...r })), stock: stockRows } };
}

/** Sell ad + organic units from stock (pro rata if short), then restock on restock days. */
function settleStock(
  ctx: MarketContext,
  prev: MarketState,
  cells: ReadonlyMap<string, CellRow>,
  stateStudentVI: ReadonlyMap<string, number>,
  stateTotalVI: ReadonlyMap<string, number>,
  day: number,
  weekday: number,
  seasonMult: number,
) {
  const { scenario, market } = ctx;
  const shares = stateShares(market);
  const adUnits = new Map<string, number>();
  for (const c of cells.values()) adUnits.set(`${c.skuId}|${c.state}`, (adUnits.get(`${c.skuId}|${c.state}`) ?? 0) + c.units);

  const stockRows: StockRow[] = [];
  const unitRatio = new Map<string, number>();
  const nextStock: Record<string, Record<string, number>> = {};
  const nextSales: Record<string, readonly number[]> = { ...prev.salesWindow };

  for (const sku of scenario.profile.skus) {
    nextStock[sku.id] = {};
    for (const st of BLINKIT_STATES) {
      const key = `${sku.id}|${st}`;
      const opening = prev.stock[sku.id]?.[st] ?? 0;
      const ads = adUnits.get(key) ?? 0;
      const totalVI = stateTotalVI.get(st) ?? 0;
      const sov = totalVI > 0 ? (stateStudentVI.get(st) ?? 0) / totalVI : 0;
      const organicPotential = organicDemand(market.organicDailyUnits[sku.id] ?? 0, shares[st] ?? 0, DOW_MULT[weekday], seasonMult, sov);
      const organic = opening > 0 ? organicPotential : 0;
      const wanted = ads + organic;
      const { sold } = sellFrom(opening, wanted);
      const ratio = wanted > 0 ? sold / wanted : 1;
      if (ratio < 1) unitRatio.set(key, ratio);
      // The window tracks demand, not sales: sized from sales, a state that ran out would
      // get ever-smaller restocks and stay empty. Only states that have held stock count.
      const everStocked = opening > 0 || prev.salesWindow[key] !== undefined;
      const window = pushWindow(prev.salesWindow[key], everStocked ? ads + organicPotential : 0, SALES_WINDOW_DAYS);
      if (everStocked) nextSales[key] = window;
      const restocked = isRestockDay(day) ? restockAmount(opening - sold, sum(window) / window.length, scenario.inventory.tone) : 0;
      const closing = opening - sold + restocked;
      const stores = CITY_STORE_COUNT[st] ?? 0;
      nextStock[sku.id][st] = closing;
      if (opening > 0 || closing > 0 || ads > 0) {
        stockRows.push({ skuId: sku.id, state: st, opening, adUnits: ads * ratio, organicUnits: organic * ratio, restocked, closing, osa: osa(closing, stores, sku.velocity) });
      }
    }
  }
  return { stockRows, nextStock, nextSales, unitRatio };
}

function nextState(
  ctx: MarketContext,
  prev: MarketState,
  day: number,
  cells: readonly CellRow[],
  rivalRows: readonly RivalDayRow[],
  termTotalVI: ReadonlyMap<string, number>,
  stock: MarketState["stock"],
  salesWindow: MarketState["salesWindow"],
): MarketState {
  // CTR history per term|sku
  const today = new Map<string, { clicks: number; viewable: number }>();
  for (const c of cells) {
    const key = `${c.term}|${c.skuId}`;
    const t = today.get(key) ?? { clicks: 0, viewable: 0 };
    today.set(key, { clicks: t.clicks + c.clicks, viewable: t.viewable + c.viewableImpressions });
  }
  const ctrWindow: Record<string, { clicks: readonly number[]; viewable: readonly number[] }> = {};
  for (const key of new Set([...Object.keys(prev.ctrWindow), ...today.keys()])) {
    const t = today.get(key) ?? { clicks: 0, viewable: 0 };
    const w = prev.ctrWindow[key];
    const next = { clicks: pushWindow(w?.clicks, t.clicks, CTR_WINDOW_DAYS), viewable: pushWindow(w?.viewable, t.viewable, CTR_WINDOW_DAYS) };
    if (sum(next.viewable) > 0) ctrWindow[key] = next;
  }

  const studentViewable: Record<string, number> = { ...prev.studentViewable };
  for (const c of cells) studentViewable[c.state] = (studentViewable[c.state] ?? 0) + c.viewableImpressions;

  // Rivals react to what they saw today on their keywords (SPEC §4.1): placement
  // spend (Stories, Spotlight...) is brand spend that counts against their budget,
  // but doesn't drive their ROAS-floor or SOV reactions.
  const rivals: Record<string, MarketState["rivals"][string]> = {};
  const rivalWindow: Record<string, { spend: readonly number[]; revenue: readonly number[] }> = {};
  for (const r of ctx.market.rivals) {
    const rows = rivalRows.filter((x) => x.rivalId === r.id);
    const keywordRows = rows.filter((x) => x.inventory === "keyword");
    const w = prev.rivalWindow[r.id];
    const next = {
      spend: pushWindow(w?.spend, sum(keywordRows.map((x) => x.spend)), RIVAL_WINDOW_DAYS),
      revenue: pushWindow(w?.revenue, sum(keywordRows.map((x) => x.revenue)), RIVAL_WINDOW_DAYS),
    };
    rivalWindow[r.id] = next;
    const spend3 = sum(next.spend);
    const sovDenominator = sum(Object.keys(r.bids).map((t) => termTotalVI.get(t) ?? 0));
    const sov = sovDenominator > 0 ? sum(keywordRows.map((x) => x.viewableImpressions)) / sovDenominator : 0;
    rivals[r.id] = updateRival(r, prev.rivals[r.id], {
      sov,
      roas3d: spend3 > 0 ? sum(next.revenue) / spend3 : null,
      spend: sum(rows.map((x) => x.spend)),
    });
  }

  const campaignSpend: Record<string, number> = { ...prev.campaignSpend };
  const week = Math.floor((day - 1) / 7);
  const campaignWeekSpend: Record<string, { week: number; spent: number }> = {};
  for (const [id, w] of Object.entries(prev.campaignWeekSpend)) if (w.week === week) campaignWeekSpend[id] = w;
  let daySpend = 0;
  for (const c of cells) {
    campaignSpend[c.campaignId] = (campaignSpend[c.campaignId] ?? 0) + c.spend;
    const w = campaignWeekSpend[c.campaignId];
    campaignWeekSpend[c.campaignId] = { week, spent: (w?.spent ?? 0) + c.spend };
    daySpend += c.spend;
  }

  return { day, stock, rivals, rivalWindow, ctrWindow, studentViewable, salesWindow, campaignSpend, campaignWeekSpend, totalSpend: prev.totalSpend + daySpend };
}
