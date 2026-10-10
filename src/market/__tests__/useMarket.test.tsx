import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMarket } from "@/market/useMarket";
import { handleStep } from "@/market/workerProtocol";
import { initialMarketState } from "@/market/state";
import type { CampaignConfig } from "@/market/engineTypes";
import { testContext } from "./testContext";

const ctx = testContext("fuelup");
const campaign: CampaignConfig = {
  id: "c1", skuIds: ["fuel-1"], keywords: [{ term: "whey protein", exactBid: 450 }],
  geography: "pan_india", cities: [], budgetType: "daily", budget: 6000, launchDay: 1,
};

describe("worker protocol", () => {
  it("returns the next day for a valid request", () => {
    const res = handleStep({ id: 7, ctx, state: initialMarketState(ctx), campaigns: [campaign] });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.day).toBe(1);
    expect(res.id).toBe(7);
  });

  it("reports an error instead of throwing", () => {
    const res = handleStep({ id: 1, ctx: { ...ctx, market: undefined as never }, state: initialMarketState(ctx), campaigns: [campaign] });
    expect(res.ok).toBe(false);
  });
});

describe("useMarket (main-thread fallback in tests)", () => {
  it("steps day by day and keeps every result", async () => {
    const { result } = renderHook(() => useMarket(ctx));
    await act(async () => { await result.current.step([campaign]); });
    await act(async () => { await result.current.step([campaign]); });
    expect(result.current.results.map((r) => r.day)).toEqual([1, 2]);
    expect(result.current.state?.day).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("does nothing without a context (brand without market data)", async () => {
    const { result } = renderHook(() => useMarket(null));
    let day: unknown = "unset";
    await act(async () => { day = await result.current.step([campaign]); });
    expect(day).toBeNull();
  });
});
