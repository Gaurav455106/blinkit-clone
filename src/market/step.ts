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
import type { KeywordData } from "@/market/types";
import { SLOT_COUNT } from "@/market/types";
import { activeSlots } from "@/market/slots";
import { searches, stateShares, DOW_MULT, type DemandContext } from "@/market/demand";
import { runAuction, backgroundBidders, type Bidder, type SlotResult } from "@/market/auction";
import { streamFor } from "@/market/rng";
import { studentEntries, type StudentEntry } from "@/market/entries";
import { rivalBid, rivalPrice, updateRival } from "@/market/rivals";
import { shopperOutcome, priceEffect, affinity } from "@/market/shoppers";
import { osa, organicDemand, sellFrom, isRestockDay, restockAmount } from "@/market/stock";

const QUARTERS_PER_SLOT = 4;
const SHOPPERS_PER_STORE = 2500;
const CTR_WINDOW_DAYS = 3;
const SALES_WINDOW_DAYS = 7;
const RIVAL_WINDOW_DAYS = 3;
const STUDENT_OWNER = "student";

/** Season demand by category (SPEC §3.1 seasonMult). */
function seasonDemandMult(season: string, categoryId: string): number {
  if (season === "Festival Surge") return 1.4;
  if (season === "Post-Festival Slowdown") return 0.6;
  if (season === "Summer Season") return categoryId === "skincare" ? 1.25 : 1.0;
  if (season === "New Year Health Spike") return categoryId === "protein" || categoryId === "supplements" ? 1.3 : 1.0;
  return 1.0;
}

function isLive(c: CampaignConfig, day: number, totalDays: number): boolean {
  return !c.paused && day >= c.launchDay && day <= (c.endDay ?? totalDays);
}

function dailyCap(c: CampaignConfig, prev: MarketState, day: number, totalDays: number): number {
  if (c.budgetType === "daily") return c.budget;
  const daysLeft = Math.max(1, (c.endDay ?? totalDays) - day + 1);
  return Math.max(0, (c.budget - (prev.campaignSpend[c.id] ?? 0)) / daysLeft);
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

interface Page {
  keyword: KeywordData;
  state: string;
  searches: number;
  others: Bidder[];
  entries: StudentEntry[];
}

type MutableCell = { -readonly [K in keyof CellRow]: CellRow[K] };
type MutableRivalRow = { -readonly [K in keyof RivalDayRow]: RivalDayRow[K] };

function resolve(pages: readonly Page[], active: ReadonlySet<string>): SlotResult[][] {
  return pages.map((p) => runAuction([
    ...p.others,
    ...p.entries
      .filter((e) => active.has(e.campaignId))
      .map((e) => ({ id: studentBidderId(e), ownerId: STUDENT_OWNER, bid: e.bid, relevance: e.relevance })),
  ]));
}

export function stepDay(
  ctx: MarketContext,
  prev: MarketState,
  campaigns: readonly CampaignConfig[],
): { state: MarketState; result: DayResult } {
  const day = prev.day + 1;
  const { scenario, market } = ctx;
  const cat = market.category;
  const weekday = (ctx.startWeekday + day - 1) % 7;
  const seasonMult = seasonDemandMult(scenario.season.name, cat.id);
  const dctx: DemandContext = { seed: ctx.seed, day, weekday, seasonMult, eventMults: [] };
  const live = campaigns.filter((c) => isLive(c, day, ctx.totalDays));
  const served = servedStates(ctx, prev);
  const skuById = new Map(scenario.profile.skus.map((s) => [s.id, s]));
  const rivalById = new Map(market.rivals.map((r) => [r.id, r]));

  // Daily caps, scaled down if they'd pass the scenario budget
  const caps = live.map((c) => [c.id, dailyCap(c, prev, day, ctx.totalDays)] as const);
  const allowed = Math.max(0, scenario.budget - prev.totalSpend);
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
    for (const keyword of market.keywords) {
      for (const st of BLINKIT_STATES) {
        const n = searches(market, keyword, st, slot, dctx);
        if (n === 0) continue;
        const rivals = market.rivals.flatMap((r) => {
          const bid = rivalBid(r, prev.rivals[r.id], keyword.term, day, cat.rivalPressure[slot]);
          return bid === null ? [] : [{ id: `rival:${r.id}`, ownerId: r.id, bid, relevance: r.relevance }];
        });
        const bg = backgroundBidders(cat, cat.rivalPressure[slot], streamFor(ctx.seed, "bg", keyword.term, st, slot, day));
        const entries = served.has(st) ? studentEntries(scheduled, keyword, st, market, scenario, prev) : [];
        pages.push({ keyword, state: st, searches: n, others: [...rivals, ...bg], entries });
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
        termTotalVI.set(p.keyword.term, (termTotalVI.get(p.keyword.term) ?? 0) + pageVI);
        stateTotalVI.set(p.state, (stateTotalVI.get(p.state) ?? 0) + pageVI);
        const rivalPricesOnPage = winners
          .filter((w) => rivalById.has(w.ownerId))
          .map((w) => rivalPrice(rivalById.get(w.ownerId)!, day));

        for (const w of winners) {
          const r = rivalById.get(w.ownerId);
          if (!r) continue;
          const vi = sq * w.viewRate;
          const out = shopperOutcome({
            viewableImpressions: vi, baseCTR: cat.baseCTR, creativeMult: 1, affinity: 1, fatigueMult: 1,
            baseCVR: cat.baseCVR, fit: 1, intent: cat.intent[slot], stateCVR: 1, priceEffect: 1,
            sellingPrice: rivalPrice(r, day), contributionPerUnit: r.contributionPerUnit,
          });
          const key = `${r.id}|${p.keyword.term}`;
          const row = rivalRows.get(key) ?? { rivalId: r.id, term: p.keyword.term, viewableImpressions: 0, totalAdViewable: 0, topSlotWins: 0, appearances: 0, spend: 0, revenue: 0 };
          row.viewableImpressions += vi;
          row.totalAdViewable += pageVI;
          row.topSlotWins += w.slot === 0 ? sq : 0;
          row.appearances += sq;
          row.spend += vi * w.price / 1000;
          row.revenue += out.revenue;
          rivalRows.set(key, row);
        }

        for (const e of p.entries) {
          const key = `${e.campaignId}|${p.keyword.term}|${e.matchType}|${p.state}|${slot}`;
          const cell = cells.get(key) ?? {
            campaignId: e.campaignId, term: p.keyword.term, matchType: e.matchType, skuId: e.skuId, state: p.state, slot,
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
            const stores = CITY_STORE_COUNT[p.state as keyof typeof CITY_STORE_COUNT] ?? 0;
            const shoppers = stores * SHOPPERS_PER_STORE;
            const reachShare = shoppers > 0 ? 1 - Math.exp(-(prev.studentViewable[p.state] ?? 0) / shoppers) : 0;
            const cheapest = rivalPricesOnPage.length ? Math.min(...rivalPricesOnPage) : null;
            const out = shopperOutcome({
              viewableImpressions: vi, baseCTR: cat.baseCTR, creativeMult: 1,
              affinity: affinity(p.keyword.isBrandTerm === true, reachShare), fatigueMult: 1,
              baseCVR: cat.baseCVR, fit: e.fit, intent: cat.intent[slot],
              stateCVR: market.stateCVR[p.state as keyof typeof market.stateCVR] ?? 1,
              priceEffect: priceEffect(sku.mrp, cheapest),
              sellingPrice: sku.mrp, contributionPerUnit: sku.margin,
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

  const state = nextState(ctx, prev, day, finalCells, [...rivalRows.values()], termTotalVI, nextStock, nextSales);
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
      const organic = opening > 0
        ? organicDemand(market.organicDailyUnits[sku.id] ?? 0, shares[st] ?? 0, DOW_MULT[weekday], seasonMult, sov)
        : 0;
      const wanted = ads + organic;
      const { sold } = sellFrom(opening, wanted);
      const ratio = wanted > 0 ? sold / wanted : 1;
      if (ratio < 1) unitRatio.set(key, ratio);
      const window = pushWindow(prev.salesWindow[key], sold, SALES_WINDOW_DAYS);
      if (sold > 0 || prev.salesWindow[key]) nextSales[key] = window;
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

  // Rivals react to what they saw today
  const rivals: Record<string, MarketState["rivals"][string]> = {};
  const rivalWindow: Record<string, { spend: readonly number[]; revenue: readonly number[] }> = {};
  for (const r of ctx.market.rivals) {
    const rows = rivalRows.filter((x) => x.rivalId === r.id);
    const spend = sum(rows.map((x) => x.spend));
    const revenue = sum(rows.map((x) => x.revenue));
    const w = prev.rivalWindow[r.id];
    const next = { spend: pushWindow(w?.spend, spend, RIVAL_WINDOW_DAYS), revenue: pushWindow(w?.revenue, revenue, RIVAL_WINDOW_DAYS) };
    rivalWindow[r.id] = next;
    const spend3 = sum(next.spend);
    const sovDenominator = sum(Object.keys(r.bids).map((t) => termTotalVI.get(t) ?? 0));
    const sov = sovDenominator > 0 ? sum(rows.map((x) => x.viewableImpressions)) / sovDenominator : 0;
    rivals[r.id] = updateRival(r, prev.rivals[r.id], { sov, roas3d: spend3 > 0 ? sum(next.revenue) / spend3 : null, spend });
  }

  const campaignSpend: Record<string, number> = { ...prev.campaignSpend };
  let daySpend = 0;
  for (const c of cells) {
    campaignSpend[c.campaignId] = (campaignSpend[c.campaignId] ?? 0) + c.spend;
    daySpend += c.spend;
  }

  return { day, stock, rivals, rivalWindow, ctrWindow, studentViewable, salesWindow, campaignSpend, totalSpend: prev.totalSpend + daySpend };
}
