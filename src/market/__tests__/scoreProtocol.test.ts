import { describe, it, expect } from "vitest";
import { handleScore } from "@/market/scoreProtocol";
import { testContext } from "@/market/__tests__/testContext";
import { campaign } from "@/market/__tests__/liveFixtures";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";

const ctx = testContext("fuelup");

describe("handleScore", () => {
  it("scores a short run without a describer function", () => {
    const launched = [campaign()];
    const s0 = initialMarketState(ctx);
    const d1 = stepDay(ctx, s0, launched);
    const res = handleScore({
      ctx, launched, formats: { c1: { adFormat: "product_booster", objective: "performance" } }, actions: [],
      results: [d1.result], configsByDay: [launched], statesByDay: [s0, d1.state], pitch: null, insights: [],
    });
    expect("score" in res && res.score.version).toBe(2);
  });

  it("returns an error instead of throwing on bad input", () => {
    const res = handleScore({ ctx: null as never, launched: [], formats: {}, actions: [], results: [], configsByDay: [], statesByDay: [], pitch: null, insights: [] });
    expect("error" in res).toBe(true);
  });
});
