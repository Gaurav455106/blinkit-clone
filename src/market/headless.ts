// ── Headless runs: play a whole run without UI (calibration, tests, scoring) ──

import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";

/** Decides today's campaigns from what has happened so far. */
export type Strategy = (day: number, state: MarketState, history: readonly DayResult[]) => readonly CampaignConfig[];

export interface RunTotals {
  spend: number;
  revenue: number;
  contribution: number;
  /** contribution − spend */
  profit: number;
  units: number;
  viewableImpressions: number;
  clicks: number;
  roas: number;
  /** Revenue-weighted break-even ROAS of what was sold (F9). */
  breakEvenRoas: number;
}

export interface HeadlessRun {
  results: readonly DayResult[];
  finalState: MarketState;
  totals: RunTotals;
}

export function totalsOf(results: readonly DayResult[], filter: (c: DayResult["cells"][number]) => boolean = () => true): RunTotals {
  let spend = 0, revenue = 0, contribution = 0, units = 0, viewableImpressions = 0, clicks = 0;
  for (const r of results) {
    for (const c of r.cells) {
      if (!filter(c)) continue;
      spend += c.spend;
      revenue += c.directRevenue + c.indirectRevenue;
      contribution += c.contribution;
      units += c.units;
      viewableImpressions += c.viewableImpressions;
      clicks += c.clicks;
    }
  }
  return {
    spend, revenue, contribution, units, viewableImpressions, clicks,
    profit: contribution - spend,
    roas: spend > 0 ? revenue / spend : 0,
    breakEvenRoas: contribution > 0 ? revenue / contribution : 0,
  };
}

export function runHeadless(ctx: MarketContext, strategy: Strategy, days = ctx.totalDays): HeadlessRun {
  let state = initialMarketState(ctx);
  const results: DayResult[] = [];
  for (let d = 1; d <= days; d++) {
    const out = stepDay(ctx, state, strategy(d, state, results));
    state = out.state;
    results.push(out.result);
  }
  return { results, finalState: state, totals: totalsOf(results) };
}
