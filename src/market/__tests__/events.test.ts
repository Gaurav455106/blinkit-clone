import { describe, it, expect } from "vitest";
import {
  evaluateEvents, eventDef, selectAlerts, seededSchedule, isActiveOn, activeOn, premiumSkuIds, peakSlot,
  demandMults, rivalBidMult, rivalExited, cvrMult, projectedRunOutDay, MARKET_EVENTS,
  MAX_PAUSING_PER_RUN, METRO_STATES,
  type EventActivation, type EventInput, type CalendarEntry, type MarketEventId,
} from "@/market/events";
import { testContext } from "@/market/__tests__/testContext";
import { cell, rivalRow, stockRow, dayResult, stateAt, campaign, historyOf } from "@/market/__tests__/liveFixtures";
import type { DayResult, MarketContext } from "@/market/engineTypes";
import { runHeadless } from "@/market/headless";

const fuel = testContext("fuelup");

function input(ctx: MarketContext, day: number, extra: Partial<EventInput> = {}): EventInput {
  return { ctx, state: stateAt(ctx, day), history: [], campaigns: [campaign()], calendar: [], ...extra };
}

const fire = (id: MarketEventId, inp: EventInput) => eventDef(id)!.trigger(inp);

describe("calendar events", () => {
  const sale: CalendarEntry = { id: "sale_day", fromDay: 15, toDay: 15 };

  it("sale day fires the evening before, with the multipliers as data", () => {
    const hist = [dayResult(14, { cells: [cell({ spend: 4200 })] })];
    const [a] = fire("sale_day", input(fuel, 14, { calendar: [sale], history: hist }));
    expect(a.startDay).toBe(15);
    expect(a.endDay).toBe(15);
    expect(a.effect.demand).toEqual([{ mult: 1.6 }]);
    expect(a.effect.rivalBids).toEqual([{ mult: 1.4, includeBackground: true }]);
    expect(a.alert.detail).toContain("1.6×");
    expect(a.alert.detail).toContain("₹4,200");
  });

  it("sale day does not fire on other days", () => {
    expect(fire("sale_day", input(fuel, 13, { calendar: [sale] }))).toHaveLength(0);
    expect(fire("sale_day", input(fuel, 15, { calendar: [sale] }))).toHaveLength(0);
  });

  it("sale day expires after its last day", () => {
    const [a] = fire("sale_day", input(fuel, 14, { calendar: [{ id: "sale_day", fromDay: 15, toDay: 16 }] }));
    expect(isActiveOn(a, 15)).toBe(true);
    expect(isActiveOn(a, 16)).toBe(true);
    expect(isActiveOn(a, 17)).toBe(false);
  });

  it("IPL evening fires for protein and snacks only, as a 6–9 PM demand shift", () => {
    const ipl: CalendarEntry = { id: "ipl_evening", fromDay: 5, toDay: 12 };
    const hist = [dayResult(4, { cells: [cell({ slot: 6, spend: 30 }), cell({ slot: 2, spend: 70 })] })];
    const [a] = fire("ipl_evening", input(fuel, 4, { calendar: [ipl], history: hist }));
    expect(a.effect.demand).toEqual([{ mult: 1.4, slots: [6] }]);
    expect(a.endDay).toBe(12);
    expect(a.alert.detail).toContain("30%");
    expect(fire("ipl_evening", input(testContext("munchbox"), 4, { calendar: [ipl] }))).toHaveLength(1);
    expect(fire("ipl_evening", input(testContext("henlo"), 4, { calendar: [ipl] }))).toHaveLength(0);
  });

  it("payday lifts CVR on premium SKUs only", () => {
    expect(premiumSkuIds(fuel)).toEqual(["fuel-1", "fuel-2"]);
    const [a] = fire("payday", input(fuel, 0, { calendar: [{ id: "payday", fromDay: 1, toDay: 3 }] }));
    expect(a.effect.cvr).toEqual([{ mult: 1.1, skuIds: ["fuel-1", "fuel-2"] }]);
    expect(a.endDay).toBe(3);
    expect(a.alert.detail).toContain("10%");
  });

  it("festival lifts demand and rival bids for its range", () => {
    const [a] = fire("festival", input(fuel, 19, { calendar: [{ id: "festival", fromDay: 20, toDay: 23, label: "Diwali" }] }));
    expect(a.alert.headline).toContain("Diwali");
    expect(a.effect.demand?.[0].mult).toBe(1.3);
    expect(a.endDay).toBe(23);
  });
});

describe("seeded events", () => {
  it("the schedule is deterministic per seed", () => {
    expect(seededSchedule(fuel)).toEqual(seededSchedule(testContext("fuelup")));
    const seeds = Array.from({ length: 12 }, (_, i) => seededSchedule(testContext("fuelup", { seed: `b${i}|fuelup` })).rain?.day);
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("rival stock-out picks a leader or challenger in a stocked state, days 10–22", () => {
    for (let i = 0; i < 20; i++) {
      const ctx = testContext("henlo", { seed: `b${i}|henlo` });
      const occ = seededSchedule(ctx).rivalStockout!;
      const rival = ctx.market.rivals.find((r) => r.id === occ.rivalId)!;
      expect(["leader", "challenger"]).toContain(rival.archetype);
      expect(ctx.scenario.cityStockMap[occ.state as keyof typeof ctx.scenario.cityStockMap]).toBeGreaterThan(0);
      expect(occ.day).toBeGreaterThanOrEqual(10);
      expect(occ.day).toBeLessThanOrEqual(22);
    }
  });

  it("rival stock-out fires on its day only, removes the rival there and expires", () => {
    const occ = seededSchedule(fuel).rivalStockout!;
    const [a] = fire("rival_stockout", input(fuel, occ.day - 1));
    expect(a.effect.rivalExits).toEqual([{ rivalId: occ.rivalId, states: [occ.state] }]);
    expect(a.endDay).toBe(occ.day + occ.days - 1);
    expect(isActiveOn(a, a.endDay + 1)).toBe(false);
    expect(a.alert.detail).toContain(String(occ.days));
    expect(fire("rival_stockout", input(fuel, occ.day))).toHaveLength(0);
    expect(fire("rival_stockout", input(fuel, occ.day - 2))).toHaveLength(0);
  });

  it("rain spike hits a stocked metro state for 1–2 days", () => {
    const occ = seededSchedule(fuel).rain!;
    expect(METRO_STATES).toContain(occ.state);
    const [a] = fire("rain_spike", input(fuel, occ.day - 1));
    expect(a.effect.demand).toEqual([{ mult: 1.5, states: [occ.state] }]);
    expect(a.alert.detail).toContain("1.5×");
    expect(fire("rain_spike", input(fuel, occ.day))).toHaveLength(0);
  });
});

describe("rival moves (detected, simulated by rivals.ts)", () => {
  const henlo = testContext("henlo");
  const conquestDay = (sov: number, day: number) => dayResult(day, {
    rivals: [rivalRow({ rivalId: "chewchamp", term: "henlo", viewableImpressions: sov * 100, totalAdViewable: 100 })],
    cells: [cell({ term: "henlo", skuId: "henlo-1", viewableImpressions: 40, totalAdViewable: 100 })],
  });

  it("rival conquest fires when a rival starts taking views on the brand term", () => {
    const [a] = fire("rival_conquest", input(henlo, 8, { history: [conquestDay(0.05, 7), conquestDay(0.3, 8)] }));
    expect(a.alert.headline).toContain("ChewChamp");
    expect(a.alert.detail).toContain("30%");
    expect(a.alert.detail).toContain("40%");
    expect(eventDef("rival_conquest")!.engineModelled).toBe(true);
    expect(a.effect).toEqual({});
  });

  it("rival conquest does not fire below the threshold or if it was already there", () => {
    expect(fire("rival_conquest", input(henlo, 8, { history: [conquestDay(0.1, 8)] }))).toHaveLength(0);
    expect(fire("rival_conquest", input(henlo, 8, { history: [conquestDay(0.3, 7), conquestDay(0.3, 8)] }))).toHaveLength(0);
  });

  it("newcomer launch fires the day after it enters, with its day-one SOV", () => {
    const vita = testContext("vitaboost");
    const launch = dayResult(10, { rivals: [rivalRow({ rivalId: "vitaleaf", term: "multivitamin", viewableImpressions: 38, totalAdViewable: 100 })] });
    const [a] = fire("newcomer_launch", input(vita, 10, { history: [launch] }));
    expect(a.alert.headline).toContain("VitaLeaf");
    expect(a.alert.detail).toContain("38%");
    expect(a.endDay - a.startDay + 1).toBe(5);
    expect(fire("newcomer_launch", input(vita, 9, { history: [launch] }))).toHaveLength(0);
    expect(fire("newcomer_launch", input(vita, 10, { history: [dayResult(10)] }))).toHaveLength(0);
  });

  it("rival price cut fires the day after the cut with the new price and CVR change", () => {
    const before = dayResult(11, { cells: [cell({ term: "protein powder", clicks: 100, units: 6 })] });
    const after = dayResult(12, { cells: [cell({ term: "protein powder", clicks: 100, units: 4 })] });
    const [a] = fire("rival_price_cut", input(fuel, 12, { history: [before, after] }));
    expect(a.alert.headline).toContain("15%");
    expect(a.alert.detail).toContain("₹764");
    expect(a.alert.detail).toContain("6%");
    expect(a.alert.detail).toContain("4%");
    expect(fire("rival_price_cut", input(fuel, 11, { history: [before] }))).toHaveLength(0);
  });
});

describe("your stock running low", () => {
  const withStock = (osa: number, state = "Karnataka") => [dayResult(9, { stock: [stockRow({ osa, state, closing: 84, adUnits: 20, organicUnits: 20 })] })];

  it("fires when OSA < 30% in a targeted state", () => {
    const [a] = fire("stock_low", input(fuel, 9, { history: withStock(0.24) }));
    expect(a.alert.detail).toContain("24%");
    expect(a.alert.detail).toContain("84 units");
    expect(a.alert.detail).toContain("2.1 days");
  });

  it("does not fire above 30%, at zero, or in a state the student doesn't target", () => {
    expect(fire("stock_low", input(fuel, 9, { history: withStock(0.4) }))).toHaveLength(0);
    expect(fire("stock_low", input(fuel, 9, { history: withStock(0) }))).toHaveLength(0);
    const delhiOnly = [campaign({ geography: "select_cities", cities: ["Delhi"] })];
    expect(fire("stock_low", input(fuel, 9, { history: withStock(0.24), campaigns: delhiOnly }))).toHaveLength(0);
    const otherSku = [campaign({ skuIds: ["fuel-3"] })];
    expect(fire("stock_low", input(fuel, 9, { history: withStock(0.24), campaigns: otherSku }))).toHaveLength(0);
  });

  it("does not fire for a paused campaign", () => {
    expect(fire("stock_low", input(fuel, 9, { history: withStock(0.24), campaigns: [campaign({ paused: true })] }))).toHaveLength(0);
  });
});

describe("budget capping before peak", () => {
  const peak = peakSlot(fuel);
  const capped = (day: number, lost: number, slot = peak) => dayResult(day, { cells: [cell({ slot, searches: 100, lostToBudget: lost, won: 100 - lost })] });

  it("the protein peak is 6–9 PM", () => expect(peak).toBe(6));

  it("fires when IS lost to budget in the peak slot is > 25% two days running", () => {
    const [a] = fire("budget_capping", input(fuel, 6, { history: [capped(5, 31), capped(6, 34)], campaignNames: { c1: "Whey, Karnataka" } }));
    expect(a.alert.headline).toContain("Whey, Karnataka");
    expect(a.alert.detail).toContain("31%");
    expect(a.alert.detail).toContain("34%");
    expect(a.alert.detail).toContain("6–9 PM");
  });

  it("does not fire for one day, below 25%, or outside the peak", () => {
    expect(fire("budget_capping", input(fuel, 6, { history: [capped(6, 34)] }))).toHaveLength(0);
    expect(fire("budget_capping", input(fuel, 6, { history: [capped(5, 20), capped(6, 34)] }))).toHaveLength(0);
    expect(fire("budget_capping", input(fuel, 6, { history: [capped(5, 40, 3), capped(6, 40, 3)] }))).toHaveLength(0);
  });
});

describe("pacing: budget runs out before day 30", () => {
  const spendDays = (perDay: number) => historyOf(5, 3, (d) => dayResult(d, { cells: [cell({ spend: perDay })] }));

  it("projects the run-out day from recent spend", () => {
    expect(projectedRunOutDay(45000, 200000, 9000, 5)).toBe(22);
    expect(projectedRunOutDay(0, 200000, 0, 5)).toBe(Infinity);
  });

  it("fires when the account budget runs out early", () => {
    const inp = { ...input(fuel, 5, { history: spendDays(9000) }), state: stateAt(fuel, 5, { totalSpend: 45000 }) };
    const [a] = fire("pacing", inp);
    expect(a.alert.headline).toBe("Budget runs out on day 22");
    expect(a.alert.detail).toContain("₹9,000");
    expect(a.alert.detail).toContain("8 days early");
  });

  it("does not fire when spend fits the budget or with too little history", () => {
    const fits = { ...input(fuel, 5, { history: spendDays(5000) }), state: stateAt(fuel, 5, { totalSpend: 25000 }) };
    expect(fire("pacing", fits)).toHaveLength(0);
    const short = { ...input(fuel, 1, { history: spendDays(9000).slice(-1) }), state: stateAt(fuel, 1, { totalSpend: 9000 }) };
    expect(fire("pacing", short)).toHaveLength(0);
  });

  it("also checks overall-budget campaigns", () => {
    const camp = campaign({ id: "c9", budgetType: "overall", budget: 30000 });
    const hist = historyOf(5, 3, (d) => dayResult(d, { cells: [cell({ campaignId: "c9", spend: 3000 })] }));
    const inp = { ...input(fuel, 5, { history: hist, campaigns: [camp] }), state: stateAt(fuel, 5, { totalSpend: 15000, campaignSpend: { c9: 15000 } }) };
    const keys = fire("pacing", inp).map((a) => a.key);
    expect(keys).toEqual(["pacing|c9"]);
  });
});

describe("evaluateEvents", () => {
  const lowStock = [dayResult(9, { stock: [stockRow({ osa: 0.2 })] })];

  it("never fires an active key twice, and fires again after it expires", () => {
    const first = evaluateEvents(input(fuel, 9, { history: lowStock }));
    const stock = first.filter((a) => a.eventId === "stock_low");
    expect(stock).toHaveLength(1);
    expect(evaluateEvents(input(fuel, 10, { history: lowStock }), first).filter((a) => a.eventId === "stock_low")).toHaveLength(0);
    const later = evaluateEvents(input(fuel, stock[0].endDay, { history: lowStock }), first);
    expect(later.filter((a) => a.eventId === "stock_low")).toHaveLength(1);
  });

  it("covers every event in SPEC §5 plus pacing", () => {
    expect(MARKET_EVENTS.map((d) => d.id).sort()).toEqual([
      "budget_capping", "festival", "ipl_evening", "newcomer_launch", "pacing", "payday",
      "rain_spike", "rival_conquest", "rival_price_cut", "rival_stockout", "sale_day", "stock_low",
    ]);
    MARKET_EVENTS.forEach((d) => expect(d.rightLevers.length).toBeGreaterThan(0));
  });

  it("runs every day of a real headless run and every alert carries a number", () => {
    const hot = { ...campaign({ budget: 12000 }), keywords: [{ term: "whey protein", exactBid: 600 }, { term: "protein powder", exactBid: 600 }, { term: "fuelup", exactBid: 300 }] };
    const run = runHeadless(fuel, () => [hot]);
    const calendar: CalendarEntry[] = [{ id: "sale_day", fromDay: 15, toDay: 15 }, { id: "payday", fromDay: 1, toDay: 3 }];
    let raised: EventActivation[] = [];
    let state = stateAt(fuel, 0);
    const history: DayResult[] = [];
    for (const r of run.results) {
      raised = [...raised, ...evaluateEvents({ ctx: fuel, state, history, campaigns: [hot], calendar }, raised)];
      history.push(r);
      state = { ...state, day: r.day, totalSpend: state.totalSpend + r.cells.reduce((s, c) => s + c.spend, 0) };
    }
    expect(raised.length).toBeGreaterThan(3);
    raised.forEach((a) => expect(a.alert.detail).toMatch(/\d/));
    expect(raised.some((a) => a.eventId === "rival_price_cut")).toBe(true);
  }, 20000);
});

describe("effect lookups", () => {
  const acts = [
    ...fire("sale_day", input(fuel, 14, { calendar: [{ id: "sale_day", fromDay: 15, toDay: 15 }] })),
    ...fire("ipl_evening", input(fuel, 14, { calendar: [{ id: "ipl_evening", fromDay: 15, toDay: 20 }] })),
    ...fire("payday", input(fuel, 14, { calendar: [{ id: "payday", fromDay: 15, toDay: 15 }] })),
  ];

  it("returns the right multipliers per day, slot and SKU", () => {
    expect(demandMults(acts, 15, "Delhi", 6, "whey protein")).toEqual([1.6, 1.4]);
    expect(demandMults(acts, 16, "Delhi", 6, "whey protein")).toEqual([1.4]);
    expect(demandMults(acts, 16, "Delhi", 3, "whey protein")).toEqual([]);
    expect(rivalBidMult(acts, 15, null, "Delhi", "x")).toBe(1.4);
    expect(rivalBidMult(acts, 16, "ironwhey", "Delhi", "x")).toBe(1);
    expect(cvrMult(acts, 15, "fuel-1", "Delhi", "x")).toBe(1.1);
    expect(cvrMult(acts, 15, "fuel-3", "Delhi", "x")).toBe(1);
    expect(activeOn(acts, 21)).toHaveLength(0);
  });

  it("knows when a rival has left a state", () => {
    const occ = seededSchedule(fuel).rivalStockout!;
    const so = fire("rival_stockout", input(fuel, occ.day - 1));
    expect(rivalExited(so, occ.day, occ.rivalId!, occ.state)).toBe(true);
    expect(rivalExited(so, occ.day, occ.rivalId!, "Goa")).toBe(false);
    expect(rivalExited(so, occ.day + occ.days, occ.rivalId!, occ.state)).toBe(false);
  });
});

describe("selectAlerts (SPEC §2 alert budget)", () => {
  const alert = (key: string, stake: number, pauses = true) => ({ key, stake, pauses } as EventActivation);
  const cands = [alert("a", 100), alert("b", 900), alert("c", 5000, false), alert("d", 400)];

  it("pauses for the pausing alert with the most at stake", () => {
    const sel = selectAlerts(cands, 0, 0);
    expect(sel.pausing?.key).toBe("b");
    expect(sel.feed.map((a) => a.key)).toEqual(["c", "d", "a"]);
  });

  it("never pauses twice in a day or past the run budget", () => {
    expect(selectAlerts(cands, 1, 2).pausing).toBeNull();
    expect(selectAlerts(cands, 0, MAX_PAUSING_PER_RUN).pausing).toBeNull();
    expect(selectAlerts(cands, 0, MAX_PAUSING_PER_RUN).feed).toHaveLength(4);
  });

  it("never pauses for a non-pausing event", () => {
    expect(selectAlerts([alert("c", 5000, false)], 0, 0).pausing).toBeNull();
  });

  it("keeps at most 8 pauses over a whole run", () => {
    let shown = 0;
    for (let day = 1; day <= 30; day++) {
      if (selectAlerts([alert(`x${day}`, day)], 0, shown).pausing) shown++;
    }
    expect(shown).toBe(MAX_PAUSING_PER_RUN);
  });
});
