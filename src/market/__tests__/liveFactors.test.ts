import { describe, it, expect } from "vitest";
import {
  findWinners, flipFlops, improvementLine, peakLine, scalingLine, steadyLine, wasScaled, LIVE_FACTOR_MAX, type LiveFactorInput,
} from "@/market/liveFactors";
import { peakSlotOf } from "@/market/momentHelpers";
import { testContext } from "@/market/__tests__/testContext";
import type { CampaignConfig, CellRow, DayResult } from "@/market/engineTypes";
import type { LiveAction } from "@/market/actions";

const ctx = testContext("henlo");
const PEAK = peakSlotOf(ctx);

const cell = (over: Partial<CellRow>): CellRow => ({
  campaignId: "c1", inventory: "keyword", term: "dog treats", matchType: "exact", skuId: "s1", state: "Karnataka", slot: PEAK,
  searches: 100, lostToStock: 0, lostToBudget: 0, lostToRank: 0, won: 100, position: 0, viewableImpressions: 1000, totalAdViewable: 2000,
  spend: 200, clicks: 20, atcs: 5, units: 5, directRevenue: 600, indirectRevenue: 0, contribution: 300, ...over,
});

const days = (n: number, cellsFor: (day: number) => CellRow[]): DayResult[] =>
  Array.from({ length: n }, (_, i) => ({ day: i + 1, cells: cellsFor(i + 1), rivals: [], stock: [] }));

const cfg: CampaignConfig = {
  id: "c1", skuIds: ["s1"], keywords: [{ term: "dog treats", exactBid: 300 }], geography: "select_cities", cities: ["Karnataka"],
  budgetType: "daily", budget: 1000, launchDay: 1,
};

const input = (results: DayResult[], actions: LiveAction[] = []): LiveFactorInput => ({
  ctx, actions, results, configsByDay: results.map(() => [cfg]),
});

describe("scaling winners", () => {
  // Earns 1.5x its spend in contribution and loses 40% of searches to rank: a winner from day 3
  const winning = days(30, () => [cell({ lostToRank: 40, won: 60 })]);

  it("finds a keyword that earns well but is short of views", () => {
    const [w] = findWinners(input(winning));
    expect(w).toMatchObject({ day: 3, term: "dog treats", bid: 300, budget: 1000, cause: "rank" });
  });

  it("asks for more budget, not a higher bid, when the budget is what ran out", () => {
    const capped = days(30, () => [cell({ lostToBudget: 40, won: 60 })]);
    const [w] = findWinners(input(capped));
    expect(w.cause).toBe("budget");
    const act = (change: LiveAction["change"]): LiveAction => ({ campaignId: "c1", dayMade: 4, change });
    expect(wasScaled(w, [act({ kind: "keywordBid", term: "dog treats", bid: 400 })])).toBe(false);
    expect(wasScaled(w, [act({ kind: "budget", budget: 1300 })])).toBe(true);
  });

  it("credits a higher bid or budget inside the window, not a lower one or a late one", () => {
    const [w] = findWinners(input(winning));
    const act = (dayMade: number, change: LiveAction["change"]): LiveAction => ({ campaignId: "c1", dayMade, change });
    expect(wasScaled(w, [act(4, { kind: "keywordBid", term: "dog treats", bid: 360 })])).toBe(true);
    expect(wasScaled(w, [act(4, { kind: "keywordBid", term: "dog treats", bid: 250 })])).toBe(false);
    expect(wasScaled(w, [act(20, { kind: "keywordBid", term: "dog treats", bid: 360 })])).toBe(false);
  });

  it("scores full when scaled, zero when ignored, full when nothing was worth scaling", () => {
    const raise: LiveAction = { campaignId: "c1", dayMade: 3, change: { kind: "keywordBid", term: "dog treats", bid: 400 } };
    expect(scalingLine(input(winning, [raise])).earned).toBe(LIVE_FACTOR_MAX.scaling);
    expect(scalingLine(input(winning)).earned).toBe(0);
    const losing = days(30, () => [cell({ lostToRank: 40, won: 60, contribution: 100 })]);
    expect(scalingLine(input(losing)).earned).toBe(LIVE_FACTOR_MAX.scaling);
  });
});

describe("getting better", () => {
  const max = LIVE_FACTOR_MAX.improvement;
  const run = (earlyContribution: number, lateContribution: number) =>
    days(30, (d) => [cell({ contribution: d <= 14 ? earlyContribution : lateContribution })]);

  it("full when late waste is low, zero when waste never fell", () => {
    expect(improvementLine(input(run(100, 300))).earned).toBe(max);
    expect(improvementLine(input(run(100, 100))).earned).toBe(0);
  });

  it("partial credit for cutting week-1 waste without getting clean", () => {
    // Week 1: one wasteful cell of two (50% waste); late: one wasteful of four (25%), so waste halved
    const halved = days(30, (d) => d <= 7
      ? [cell({ contribution: 100 }), cell({ term: "b" })]
      : [cell({ contribution: 100 }), cell({ term: "b" }), cell({ term: "c" }), cell({ term: "e" })]);
    expect(improvementLine(input(halved)).earned).toBe(max);
    // Late waste one of three (33%): two thirds of the way to halving
    const cut = days(30, (d) => d <= 7
      ? [cell({ contribution: 100 }), cell({ term: "b" })]
      : [cell({ contribution: 100 }), cell({ term: "b" }), cell({ term: "c" })]);
    expect(improvementLine(input(cut)).earned).toBeCloseTo(max * (2 / 3), 1);
  });
});

describe("peak hours covered", () => {
  const max = LIVE_FACTOR_MAX.peak;
  const quiet = (PEAK + 4) % 8;

  it("full when no campaign runs out of budget", () => {
    expect(peakLine(input(days(30, () => [cell({})]))).earned).toBe(max);
  });

  it("zero when a capped campaign loses the peak hour, full when it keeps it", () => {
    const lostPeak = days(30, () => [cell({ slot: quiet }), cell({ lostToBudget: 100, won: 0, spend: 0 })]);
    expect(peakLine(input(lostPeak)).earned).toBe(0);
    const keptPeak = days(30, () => [cell({ slot: quiet, lostToBudget: 100, won: 0 }), cell({})]);
    expect(peakLine(input(keptPeak)).earned).toBe(max);
  });
});

describe("steady hands", () => {
  const bid = (dayMade: number, term = "dog treats"): LiveAction => ({ campaignId: "c1", dayMade, change: { kind: "keywordBid", term, bid: 300 + dayMade } });

  it("flags the same setting changed more than twice in three days", () => {
    expect(flipFlops([bid(5), bid(6), bid(7)])).toHaveLength(1);
    expect(flipFlops([bid(5), bid(8), bid(11)])).toHaveLength(0);
    expect(flipFlops([bid(5, "a"), bid(5, "b"), bid(5, "c")])).toHaveLength(0);
  });

  it("loses a point per flip-flopped setting", () => {
    const max = LIVE_FACTOR_MAX.steady;
    expect(steadyLine(input([], [])).earned).toBe(max);
    expect(steadyLine(input([], [bid(5), bid(6), bid(7)])).earned).toBe(max - 1);
    const many = ["a", "b", "c", "d"].flatMap((t) => [bid(5, t), bid(6, t), bid(7, t)]);
    expect(steadyLine(input([], many)).earned).toBe(0);
  });
});
