import { describe, it, expect } from "vitest";
import {
  afterDay, actionLevers, scoreEventResponses, dropStatesActions, relationshipNow, ROHIT_QUALITY_SHARE,
} from "@/market/liveRun";
import type { EventActivation, LeverId } from "@/market/events";
import { MAX_PAUSING_PER_RUN } from "@/market/events";
import type { LiveAction } from "@/market/actions";
import type { CommitmentResult } from "@/market/rohit";
import { marketCalendar } from "@/market/calendar";
import { testContext } from "@/market/__tests__/testContext";
import { campaign, stateAt } from "@/market/__tests__/liveFixtures";
import { initialMarketState } from "@/market/state";

const fuel = testContext("fuelup");

function alert(levers: LeverId[], raisedAfterDay = 9, window = 2, key = "k"): EventActivation {
  return {
    eventId: "newcomer_launch", key, title: "Test", raisedAfterDay, startDay: raisedAfterDay + 1, endDay: raisedAfterDay + 5,
    decisionWindowDays: window, effect: {}, pauses: true, rightLevers: levers, stake: 1000, data: {},
    alert: { headline: "h", detail: "d", report: { id: "R1", label: "" } },
  };
}

const act = (change: LiveAction["change"], dayMade = 10, campaignId = "c1"): LiveAction => ({ campaignId, dayMade, change });

describe("afterDay", () => {
  it("before day 1 it raises payday from the brand's calendar", () => {
    const out = afterDay({
      ctx: fuel, state: initialMarketState(fuel), history: [], campaigns: [campaign()],
      calendar: marketCalendar(fuel.scenario), existing: [], pausingShown: 0, asked: [], relationship: 50,
    });
    expect(out.fresh.map((a) => a.eventId)).toContain("payday");
  });

  it("never re-raises an activation that is still running", () => {
    const base = { ctx: fuel, state: initialMarketState(fuel), history: [], campaigns: [campaign()], calendar: marketCalendar(fuel.scenario), pausingShown: 0, asked: [], relationship: 50 };
    const first = afterDay({ ...base, existing: [] });
    const again = afterDay({ ...base, existing: first.fresh });
    expect(again.fresh).toHaveLength(0);
  });

  it("stops pausing the clock once the run's alert budget is used", () => {
    const out = afterDay({
      ctx: fuel, state: initialMarketState(fuel), history: [], campaigns: [campaign()],
      calendar: marketCalendar(fuel.scenario), existing: [], pausingShown: MAX_PAUSING_PER_RUN, asked: [], relationship: 50,
    });
    expect(out.pausing).toBeNull();
  });

  it("offers Rohit only on a check-in day", () => {
    const common = { ctx: fuel, history: [], campaigns: [campaign()], calendar: [], existing: [], pausingShown: 0, asked: [], relationship: 50 };
    expect(afterDay({ ...common, state: stateAt(fuel, 5) }).ask).toBeNull();
  });
});

describe("actionLevers", () => {
  const before = [campaign({ keywords: [{ term: "whey protein", exactBid: 450 }], budget: 5000 })];
  it("reads the direction of bid and budget changes", () => {
    expect(actionLevers(act({ kind: "keywordBid", term: "whey protein", bid: 520 }), before, fuel)).toContain("raise_bid");
    expect(actionLevers(act({ kind: "keywordBid", term: "whey protein", bid: 300 }), before, fuel)).toContain("lower_bid");
    expect(actionLevers(act({ kind: "budget", budget: 7000 }), before, fuel)).toContain("raise_budget");
    expect(actionLevers(act({ kind: "budget", budget: 3000 }), before, fuel)).toContain("lower_budget");
  });

  it("names schedule, pause, state and keyword changes", () => {
    expect(actionLevers(act({ kind: "schedule", schedule: [5, 6] }), before, fuel)).toEqual(["daypart"]);
    expect(actionLevers(act({ kind: "pauseKeyword", term: "whey protein", paused: true }), before, fuel)).toContain("pause_keyword");
    const longTail = fuel.market.keywords.find((k) => k.tier === "long")!.term;
    expect(actionLevers(act({ kind: "addKeyword", term: longTail, bid: 300 }), before, fuel)).toEqual(expect.arrayContaining(["add_keyword", "shift_to_long_tail"]));
    expect(actionLevers(act({ kind: "states", geography: "select_cities", cities: ["Karnataka"] }), before, fuel)).toContain("remove_state");
  });
});

describe("scoreEventResponses", () => {
  const launched = [campaign({ keywords: [{ term: "whey protein", exactBid: 450 }], budget: 5000 })];

  it("a right lever inside the window scores full", () => {
    const r = scoreEventResponses([alert(["lower_bid"])], [act({ kind: "keywordBid", term: "whey protein", bid: 380 }, 10)], launched, fuel);
    expect(r.items[0].verdict).toBe("right");
    expect(r.share).toBe(1);
  });

  it("a right lever after the window is late and scores nothing", () => {
    const r = scoreEventResponses([alert(["lower_bid"], 9, 2)], [act({ kind: "keywordBid", term: "whey protein", bid: 380 }, 12)], launched, fuel);
    expect(r.items[0].verdict).toBe("none");
    expect(r.share).toBe(0);
  });

  it("another change scores partly; holding is right when 'hold' is a right lever", () => {
    const other = scoreEventResponses([alert(["lower_bid"])], [act({ kind: "schedule", schedule: [6] }, 10)], launched, fuel);
    expect(other.items[0].verdict).toBe("other");
    expect(other.share).toBeGreaterThan(0);
    expect(other.share).toBeLessThan(1);
    const held = scoreEventResponses([alert(["hold", "shift_to_long_tail"])], [], launched, fuel);
    expect(held.items[0].verdict).toBe("held");
    expect(held.share).toBe(1);
  });

  it("no alerts means nothing to score (share 1)", () => {
    expect(scoreEventResponses([], [], launched, fuel).share).toBe(1);
  });
});

describe("dropStatesActions", () => {
  it("turns Pan India into the served states minus the dropped one", () => {
    const [a] = dropStatesActions([campaign({ geography: "pan_india" })], ["Karnataka", "Delhi", "Maharashtra"], ["Delhi"], 8);
    expect(a.change).toEqual({ kind: "states", geography: "select_cities", cities: ["Karnataka", "Maharashtra"] });
    expect(a.dayMade).toBe(8);
  });

  it("removes the state from a selected list and leaves other campaigns alone", () => {
    const out = dropStatesActions([
      campaign({ id: "a", geography: "select_cities", cities: ["Delhi", "Karnataka"] }),
      campaign({ id: "b", geography: "select_cities", cities: ["Karnataka"] }),
    ], ["Karnataka", "Delhi"], ["Delhi"], 8);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ campaignId: "a", change: { cities: ["Karnataka"] } });
  });

  it("pauses a campaign whose only state is dropped", () => {
    const [a] = dropStatesActions([campaign({ geography: "select_cities", cities: ["Delhi"] })], ["Delhi"], ["Delhi"], 8);
    expect(a.change).toEqual({ kind: "pause", paused: true });
  });
});

describe("relationshipNow", () => {
  it("adds reply deltas and kept/broken promises, clamped to 0–100", () => {
    const kept = { status: "kept", commitment: { keptDelta: 10, brokenDelta: -15 } } as unknown as CommitmentResult;
    const broken = { status: "broken", commitment: { keptDelta: 10, brokenDelta: -15 } } as unknown as CommitmentResult;
    expect(relationshipNow(50, [{ delta: 5 }], [kept])).toBe(65);
    expect(relationshipNow(50, [], [broken])).toBe(35);
    expect(relationshipNow(95, [{ delta: 20 }], [])).toBe(100);
  });

  it("quality shares rank strong over ok over weak", () => {
    expect(ROHIT_QUALITY_SHARE.strong).toBeGreaterThan(ROHIT_QUALITY_SHARE.ok);
    expect(ROHIT_QUALITY_SHARE.ok).toBeGreaterThan(ROHIT_QUALITY_SHARE.weak);
  });
});
