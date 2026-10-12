// ── Live optimisation sanity per brand (SPEC §13 #35): `npm run calibrate` ────
// Plays each brand's competent setup three ways: hands off, an active optimiser
// (cut losers, scale winners every 3 days) and a fiddler (re-bids the same keyword
// daily). The live marks must rank them active > hands off, and the fiddler must
// lose its steady-hands marks.

import { describe, it, expect } from "vitest";
import { scoreRunV2 } from "@/market/scoringV2";
import { applyActions, recordAction, type LiveAction } from "@/market/actions";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import { byUnit } from "@/market/aggregate";
import { lossFloorFor } from "@/market/moments";
import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import * as S from "@/market/calibration/strategies";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "@/market/__tests__/testContext";

type Player = (ctx: MarketContext, day: number, results: readonly DayResult[], configs: readonly CampaignConfig[]) => LiveAction[];

const handsOff: Player = () => [];

/** Every 3 days: cut what loses money (sales goals only: reach goals count views below
 *  break-even); for whatever earns well and misses searches, raise the budget 30% if the
 *  budget ran out, else the bid 20%. */
const optimiser: Player = (ctx, day, results, configs) => {
  if (day < 4 || day % 3 !== 1) return [];
  const floor = lossFloorFor(ctx.scenario.profile.goalType);
  const recent = results.slice(-3);
  return configs.flatMap((cfg) => {
    const units = byUnit(recent.flatMap((r) => r.cells.filter((c) => c.campaignId === cfg.id)));
    const earning = (u: (typeof units)[number]) => u.spend > 0 && u.contribution >= u.spend * floor
      && u.searches > 0 && (u.lostToRank + u.lostToBudget) / u.searches > 0.25;
    const budgetBound = units.some((u) => earning(u) && u.lostToBudget > u.lostToRank);
    const raise: LiveAction[] = budgetBound ? [{ campaignId: cfg.id, dayMade: day, change: { kind: "budget", budget: Math.round(cfg.budget * 1.3) } }] : [];
    return [...raise, ...units.flatMap((u): LiveAction[] => {
      const kw = cfg.keywords.find((k) => k.term === u.key);
      const pl = cfg.placements?.find((p) => p.id === u.key);
      if ((!kw && !pl) || u.spend <= 0) return [];
      if (kw && floor === 1 && u.contribution < u.spend) return [{ campaignId: cfg.id, dayMade: day, change: { kind: "pauseKeyword", term: kw.term, paused: true } }];
      if (!earning(u) || u.lostToBudget > u.lostToRank) return [];
      return [kw
        ? { campaignId: cfg.id, dayMade: day, change: { kind: "keywordBid", term: kw.term, bid: Math.round(kw.exactBid * 1.2) } }
        : { campaignId: cfg.id, dayMade: day, change: { kind: "placementBid", id: pl!.id, bid: Math.round(pl!.bid * 1.2) } }];
    })];
  });
};

/** Re-bids its first keyword up and down every day. */
const fiddler: Player = (_ctx, day, _results, configs) => {
  const cfg = configs[0];
  const kw = cfg?.keywords[0];
  if (!cfg || !kw || day < 2) return [];
  return [{ campaignId: cfg.id, dayMade: day, change: { kind: "keywordBid", term: kw.term, bid: Math.round(kw.exactBid * (day % 2 ? 1.1 : 0.9)) } }];
};

function play(ctx: MarketContext, player: Player) {
  const launched = S.competent(ctx)(1, initialMarketState(ctx), []);
  let state = initialMarketState(ctx);
  const statesByDay: MarketState[] = [state];
  const results: DayResult[] = [];
  const configsByDay: CampaignConfig[][] = [];
  let actions: LiveAction[] = [];
  for (let d = 1; d <= ctx.totalDays; d++) {
    actions = [...actions, ...player(ctx, d, results, applyActions(launched, actions, d))];
    const cfgs = applyActions(launched, actions, d);
    const out = stepDay(ctx, state, cfgs);
    state = out.state;
    statesByDay.push(state);
    results.push(out.result);
    configsByDay.push(cfgs);
  }
  const formats = Object.fromEntries(launched.map((c) => [c.id, { adFormat: "product_booster", objective: "performance" }]));
  return scoreRunV2({ ctx, launched, formats, actions, results, configsByDay, statesByDay, pitch: null, insights: [], describeAction: (a) => recordAction(launched, a).what });
}

const liveOf = (s: ReturnType<typeof play>, key: string) => s.lines.find((l) => l.key === key)?.earned ?? 0;

const runs = Object.keys(MARKET_DATA).map((brand) => {
  const ctx = testContext(brand);
  return { brand, passive: play(ctx, handsOff), active: play(ctx, optimiser), busy: play(ctx, fiddler) };
});

describe("live optimisation across brands", () => {
  it("an active optimiser never trails hands off by more than a mark, and wins clearly on most brands", () => {
    for (const r of runs) console.log(`  ${r.brand}: live hands off ${r.passive.totals.live}, active ${r.active.totals.live}, fiddler ${r.busy.totals.live}`);
    expect(runs.every((r) => r.active.totals.live >= r.passive.totals.live - 1)).toBe(true);
    expect(runs.filter((r) => r.active.totals.live >= r.passive.totals.live + 5).length).toBeGreaterThanOrEqual(5);
  });

  for (const r of runs) {
    it(`${r.brand}: the 35 live marks add up and no line goes out of range`, () => {
      const live = r.active.lines.filter((l) => l.category === "live");
      expect(live.reduce((s, l) => s + l.max, 0)).toBeCloseTo(35, 0);
      expect(live.every((l) => l.earned >= 0 && l.earned <= l.max)).toBe(true);
    });

    it(`${r.brand}: a fiddler loses steady-hands marks`, () => {
      expect(liveOf(r.busy, "v2_steady")).toBeLessThan(liveOf(r.passive, "v2_steady"));
    });
  }
});
