// "How Rohit worked this out": the deal's value line by line, so a student can see
// which ask costs Rohit what and why a promise counts for less than its face value.
// Every amount comes from askCost / giveValue, so the lines always add up to the
// totals Rohit quotes; only the explanation is written here.

import type { MarketContext } from "@/market/engineTypes";
import type { DealAsk, DealGive, DealTerms } from "@/market/deal";
import { FAST_RESTOCK_SHARE, MORE_STORES_SHARE } from "@/market/deal";
import { EXPEDITE_FEE_PER_UNIT, MIN_EXPEDITE_FEE } from "@/market/rohit";
import { inr, pct } from "@/market/events";
import {
  askCost, askLabel, BUSY_STORES_COST_RATE, demandFactor, discountPerUnit, DISCOUNT_DAYS_VALUED, DISCOUNT_TRAFFIC,
  giveValue, PROMISE_CREDIT, quietFactor, SHELF_COST_RATE, stockValueIn, SUPPLY_PROMISE_VALUE,
} from "@/market/dealRohit";

export interface ValueLine {
  key: string;
  label: string;
  /** ₹ over the run, exactly as Rohit counts it. */
  value: number;
  /** The working, in plain words. */
  how: string;
}

export interface DealValue {
  asks: ValueLine[];
  gives: ValueLine[];
  asked: number;
  given: number;
  /** given − asked. Below 0, Rohit counters. */
  balance: number;
}

const times = (x: number) => `${Number(x.toFixed(1))}×`;
const count = (n: number) => Math.round(n).toLocaleString("en-IN");
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const unitsIn = (d: DealTerms, state: string) => Object.values(d.stock).reduce((s, row) => s + (row[state] ?? 0), 0);

function askHow(ctx: MarketContext, d: DealTerms, a: DealAsk): string {
  switch (a.kind) {
    case "shelfSpot":
      return "A fixed price for a featured shelf spot.";
    case "busyStores":
      return `${inr(stockValueIn(ctx, d, a.state))} of your stock in ${a.state} (units × price) × ${pct(BUSY_STORES_COST_RATE)} × ${times(demandFactor(ctx, a.state))} for how busy ${a.state} is against an average state. Busy stores are scarce, so they cost more where people search most.`;
    case "moreStores":
      return `${pct(MORE_STORES_SHARE)} more of your ${count(unitsIn(d, a.state))} units in ${a.state}, at their price, × ${pct(SHELF_COST_RATE)} shelf cost × ${times(quietFactor(ctx, a.state))} for how quiet ${a.state} is. Extra stores cost Rohit more where fewer people search.`;
    case "fastRestock":
      return `${pct(FAST_RESTOCK_SHARE)} of your ${count(unitsIn(d, a.state))} units in ${a.state} × ${inr(EXPEDITE_FEE_PER_UNIT)} a unit to rush, with a minimum of ${inr(MIN_EXPEDITE_FEE)}.`;
  }
}

function giveHow(ctx: MarketContext, g: DealGive): string {
  switch (g.kind) {
    case "adSpend":
      return `${inr(g.perDay)} a day × ${g.days} days = ${inr(g.perDay * g.days)}. Rohit counts ${pct(PROMISE_CREDIT)} of it because a promise isn't money yet.`;
    case "supply":
      return `${inr(SUPPLY_PROMISE_VALUE)} for a full stock promise × the ${g.osaPct}% of stores you'll keep stocked.`;
    case "discount": {
      const off = g.skuIds.reduce((s, id) => s + discountPerUnit(ctx, id, g.pct) * (ctx.market.organicDailyUnits[id] ?? 0) * DISCOUNT_DAYS_VALUED, 0);
      return `${inr(off)} of discount on your usual sales over ${DISCOUNT_DAYS_VALUED} days × ${DISCOUNT_TRAFFIC} for the extra shoppers a discount brings to his shelf.`;
    }
  }
}

function giveLabel(g: DealGive): string {
  if (g.kind === "adSpend") return "Ad spend promise";
  if (g.kind === "supply") return `Keep ${g.osaPct}% of stores stocked in ${g.state}`;
  return `${pct(g.pct)} launch discount`;
}

/** Each ask and offer with its value and the working; totals match valueAsked / valueGiven. */
export function dealValue(ctx: MarketContext, d: DealTerms): DealValue {
  const asks = d.asks.map((a, i) => ({ key: `ask-${a.kind}-${i}`, label: capital(askLabel(a, "a")), value: askCost(ctx, d, a), how: askHow(ctx, d, a) }));
  const gives = d.gives.map((g, i) => ({ key: `give-${g.kind}-${i}`, label: giveLabel(g), value: giveValue(ctx, g), how: giveHow(ctx, g) }));
  const asked = asks.reduce((s, l) => s + l.value, 0);
  const given = gives.reduce((s, l) => s + l.value, 0);
  return { asks, gives, asked, given, balance: given - asked };
}
