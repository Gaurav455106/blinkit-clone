// ── Score sanity per brand (SPEC §13 #29-31): `npm run calibrate` ─────────────
// Scores each brand's recommended-format and competent search play with no live
// changes, and checks the scoring decisions from the 7-brand trainer run hold.

import { describe, it, expect } from "vitest";
import { scoreRunV2, wastedSpendShare } from "@/market/scoringV2";
import { applyActions, recordAction } from "@/market/actions";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import * as S from "@/market/calibration/strategies";
import { goodFormatsFor } from "@/market/formats";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "@/market/__tests__/testContext";

function scorePassive(ctx: MarketContext, launched: CampaignConfig[], adFormat: string) {
  let state = initialMarketState(ctx);
  const statesByDay: MarketState[] = [state];
  const results: DayResult[] = [];
  const configsByDay: CampaignConfig[][] = [];
  for (let d = 1; d <= ctx.totalDays; d++) {
    const cfgs = applyActions(launched, [], d);
    const out = stepDay(ctx, state, cfgs);
    state = out.state;
    statesByDay.push(state);
    results.push(out.result);
    configsByDay.push(cfgs);
  }
  const formats = Object.fromEntries(launched.map((c) => [c.id, { adFormat, objective: null }]));
  const score = scoreRunV2({ ctx, launched, formats, actions: [], results, configsByDay, statesByDay, pitch: null, insights: [], describeAction: (a) => recordAction(launched, a).what });
  return { score, wasted: wastedSpendShare(results) };
}

const LIVE_MAX = 35;
const WASTEFUL = 0.25;

for (const brandId of Object.keys(MARKET_DATA)) {
  describe(`score sanity: ${brandId}`, () => {
    const ctx = testContext(brandId);
    const best = goodFormatsFor(ctx.scenario)[0];
    const reach = S.awarenessDefault(ctx);
    const strategy = reach ?? S.competent(ctx);
    const { score, wasted } = scorePassive(ctx, [...strategy(0, initialMarketState(ctx), [])], best);
    const live = score.lines.filter((l) => l.category === "live").reduce((s, l) => s + l.earned, 0);

    it(`the brand's best format (${best}) gets full format marks`, () => {
      expect(score.lines.find((l) => l.key === "v2_format")?.earned).toBe(8);
    });

    it("a passive run that wastes over 25% of its spend doesn't get full live points", () => {
      console.log(`${brandId}: total ${score.grandTotal.toFixed(1)}, live ${live.toFixed(1)}/35, wasted ${Math.round(wasted * 100)}%`);
      if (wasted > WASTEFUL) expect(live).toBeLessThan(LIVE_MAX * (1 - WASTEFUL) + 0.5);
    });
  });
}
