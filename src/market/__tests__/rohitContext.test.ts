import { describe, it, expect } from "vitest";
import { askDef, type RohitInput } from "@/market/rohit";
import { scoreEventResponses } from "@/market/liveRun";
import { EMPTY_ADJUSTMENTS } from "@/market/adjustments";
import type { EventActivation, LeverId } from "@/market/events";
import { testContext } from "@/market/__tests__/testContext";
import { cell, dayResult, stateAt, campaign, historyOf } from "@/market/__tests__/liveFixtures";

const vita = testContext("vitaboost");

describe("Rohit only offers replies the account can carry out (SPEC §13 #34)", () => {
  it("a losing Stories-only account is told to lower the losing placement, not stop keywords", () => {
    const losing = (d: number) => dayResult(d, { cells: [cell({ inventory: "stories", term: "stories:main-feed", skuId: "vita-1", spend: 1000, contribution: 300, directRevenue: 1200 })] });
    const stories = campaign({ keywords: [], placements: [{ id: "stories:main-feed", bid: 500 }] });
    const inp: RohitInput = { ctx: vita, state: stateAt(vita, 7), history: historyOf(7, 3, losing), campaigns: [stories], relationship: 50 };
    const built = askDef("roas_below_breakeven")!.build(inp);
    const labels = built.options.map((o) => o.label).join(" | ");
    expect(labels).not.toMatch(/keyword/i);
    expect(labels).toContain("Stories: main feed");
    expect(built.chips.map((c) => c.label).join(" ")).not.toMatch(/keyword/i);
  });
});

describe("a Rohit action that matches an open alert counts as the response", () => {
  const stockAlert = (levers: LeverId[]): EventActivation => ({
    eventId: "stock_low", key: "stock_low|fuel-1|Karnataka", title: "Your stock running low", raisedAfterDay: 4, startDay: 5, endDay: 8,
    decisionWindowDays: 3, effect: {}, pauses: true, rightLevers: levers, stake: 1000, data: { skuId: "fuel-1", state: "Karnataka" },
    alert: { headline: "h", detail: "d", report: { id: "R9", label: "" } },
  });
  const fuel = testContext("fuelup");
  const launched = [campaign()];

  it("a rush restock to that state and product answers the stock alert", () => {
    const adj = { ...EMPTY_ADJUSTMENTS, stockAdds: [{ day: 8, state: "Karnataka", skuId: "fuel-1", units: 300 }] };
    const r = scoreEventResponses([stockAlert(["ask_rohit_restock", "lower_bid"])], [], launched, fuel, adj);
    expect(r.items[0].verdict).toBe("right");
  });

  it("stock sent to a different state doesn't", () => {
    const adj = { ...EMPTY_ADJUSTMENTS, stockAdds: [{ day: 8, state: "Delhi", skuId: "fuel-1", units: 300 }] };
    const r = scoreEventResponses([stockAlert(["ask_rohit_restock"])], [], launched, fuel, adj);
    expect(r.items[0].verdict).toBe("none");
  });
});
