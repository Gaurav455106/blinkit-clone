// stepDay with market events (SPEC §5, F12) and Rohit reply effects (§6).

import { describe, it, expect } from "vitest";
import { stepDay } from "@/market/step";
import { initialMarketState } from "@/market/state";
import type { CampaignConfig, CellRow, DayResult } from "@/market/engineTypes";
import type { EventActivation, EventEffect } from "@/market/events";
import { adjustmentsFromReply, EMPTY_ADJUSTMENTS, mergeAdjustments } from "@/market/adjustments";
import { testContext } from "@/market/__tests__/testContext";
import { BLINKIT_STATES } from "@/data/scenarios";

const fuel = testContext("fuelup");

function camp(overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    id: "c1", skuIds: ["fuel-1"],
    keywords: [{ term: "whey protein", exactBid: 450 }, { term: "whey protein chocolate", exactBid: 450 }],
    geography: "pan_india", cities: [], budgetType: "daily", budget: 6000, launchDay: 1,
    ...overrides,
  };
}

function activation(effect: EventEffect, startDay = 1, endDay = 1): EventActivation {
  return {
    eventId: "sale_day", key: `test|${JSON.stringify(effect)}`, title: "Test", raisedAfterDay: startDay - 1,
    startDay, endDay, decisionWindowDays: 1, effect, pauses: false, rightLevers: [], stake: 0, data: {},
    alert: { headline: "", detail: "", report: { id: "R1", label: "" } },
  };
}

const sum = (rows: readonly CellRow[], key: keyof CellRow) => rows.reduce((s, r) => s + (r[key] as number), 0);
const day1 = (opts?: Parameters<typeof stepDay>[3], campaigns = [camp()]) => stepDay(fuel, initialMarketState(fuel), campaigns, opts);
const cpm = (r: DayResult) => (sum(r.cells, "spend") / sum(r.cells, "viewableImpressions")) * 1000;

describe("stepDay with events", () => {
  it("no events gives exactly the same day as before", () => {
    expect(day1({ events: [] })).toEqual(day1());
  });

  it("a demand event raises searches", () => {
    const base = day1().result;
    const sale = day1({ events: [activation({ demand: [{ mult: 1.6 }] })] }).result;
    expect(sum(sale.cells, "searches")).toBeGreaterThan(sum(base.cells, "searches") * 1.4);
  });

  it("a demand event outside its days changes nothing", () => {
    expect(day1({ events: [activation({ demand: [{ mult: 1.6 }] }, 5, 6)] })).toEqual(day1());
  });

  it("a demand event limited to one slot only changes that slot", () => {
    const base = day1().result;
    const ipl = day1({ events: [activation({ demand: [{ mult: 1.4, slots: [6] }] })] }).result;
    const slotSearches = (r: DayResult, slot: number) => sum(r.cells.filter((c) => c.slot === slot), "searches");
    expect(slotSearches(ipl, 6)).toBeGreaterThan(slotSearches(base, 6));
    expect(slotSearches(ipl, 2)).toBeCloseTo(slotSearches(base, 2), 6);
  });

  it("rivals and other brands bidding more raises the student's CPM", () => {
    const base = day1().result;
    const hot = day1({ events: [activation({ rivalBids: [{ mult: 1.4, includeBackground: true }] })] }).result;
    expect(cpm(hot)).toBeGreaterThan(cpm(base));
  });

  it("a rival that exits every state disappears from auction insights", () => {
    const rivalId = fuel.market.rivals[0].id;
    const all = [...BLINKIT_STATES];
    const out = day1({ events: [activation({ rivalExits: [{ rivalId, states: all }] })] }).result;
    expect(day1().result.rivals.some((r) => r.rivalId === rivalId)).toBe(true);
    expect(out.rivals.some((r) => r.rivalId === rivalId && r.inventory === "keyword")).toBe(false);
  });

  it("a conversion lift sells more units on the SKUs it names only", () => {
    const base = day1().result;
    const lifted = day1({ events: [activation({ cvr: [{ mult: 1.5, skuIds: ["fuel-1"] }] })] }).result;
    const other = day1({ events: [activation({ cvr: [{ mult: 1.5, skuIds: ["fuel-3"] }] })] }).result;
    expect(sum(lifted.cells, "units")).toBeGreaterThan(sum(base.cells, "units"));
    expect(sum(other.cells, "units")).toBeCloseTo(sum(base.cells, "units"), 6);
  });
});

describe("stepDay with Rohit reply effects", () => {
  it("no adjustments gives exactly the same day", () => {
    expect(day1({ adjustments: EMPTY_ADJUSTMENTS })).toEqual(day1());
  });

  it("a restock arrives on its day and opens a new state for ads", () => {
    const adj = adjustmentsFromReply({ relationshipDelta: 0, addStock: { state: "Gujarat", units: { "fuel-1": 400 }, fromDay: 1 } }, 0);
    const { state, result } = day1({ adjustments: adj });
    expect(result.stock.find((r) => r.state === "Gujarat" && r.skuId === "fuel-1")?.opening).toBe(400);
    expect(result.cells.some((c) => c.state === "Gujarat" && c.won > 0)).toBe(true);
    expect(state.stock["fuel-1"].Gujarat).toBeGreaterThan(0);
  });

  it("a restock after N days does not arrive early", () => {
    const adj = adjustmentsFromReply({ relationshipDelta: 0, restock: { state: "Gujarat", units: { "fuel-1": 400 }, afterDays: 3 } }, 0);
    expect(adj.stockAdds[0].day).toBe(3);
    expect(day1({ adjustments: adj }).result.stock.find((r) => r.state === "Gujarat")).toBeUndefined();
  });

  it("a fee paid to Rohit counts against the scenario budget the next day", () => {
    const adj = adjustmentsFromReply({ relationshipDelta: 0, cost: 15000 }, 0);
    const base = day1();
    const paid = day1({ adjustments: adj });
    expect(paid.state.totalSpend).toBeCloseTo(base.state.totalSpend + 15000, 6);
    expect(adj.extraSpend[0]).toMatchObject({ day: 1, amount: 15000 });
  });

  it("a shelf boost wins more searches at the same bids", () => {
    const adj = adjustmentsFromReply({ relationshipDelta: 0, shelfBoost: { relevanceMult: 1.3, days: 5 } }, 0);
    expect(sum(day1({ adjustments: adj }).result.cells, "won")).toBeGreaterThanOrEqual(sum(day1().result.cells, "won"));
    expect(cpm(day1({ adjustments: adj }).result)).toBeLessThanOrEqual(cpm(day1().result) + 1e-9);
  });

  it("a funded discount sells more but earns less per unit", () => {
    const adj = adjustmentsFromReply({ relationshipDelta: 0, discount: { pct: 0.15, skuIds: ["fuel-1"], days: 3, marginPerUnit: { "fuel-1": 120 } } }, 0);
    const base = day1().result;
    const disc = day1({ adjustments: adj }).result;
    const perUnit = (r: DayResult) => sum(r.cells, "contribution") / sum(r.cells, "units");
    expect(perUnit(disc)).toBeLessThan(perUnit(base));
  });

  it("merging keeps every adjustment", () => {
    const a = adjustmentsFromReply({ relationshipDelta: 0, cost: 1000 }, 2);
    const b = adjustmentsFromReply({ relationshipDelta: 0, cost: 2000 }, 4);
    expect(mergeAdjustments(a, b).extraSpend.map((x) => x.day)).toEqual([3, 5]);
  });
});
