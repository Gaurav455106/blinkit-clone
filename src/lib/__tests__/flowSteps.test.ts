import { describe, expect, it } from "vitest";
import { FLOW_STEPS, flowStepOfPath, stepDone, stepLock, type FlowProgress } from "../flowSteps";

const start: FlowProgress = { briefDone: false, dealDone: false, runStarted: false, runDone: false, anyRunCompleted: false };

describe("flow steps", () => {
  it("has one set of names, in order", () => {
    expect(FLOW_STEPS.map((s) => s.label)).toEqual(["Brief", "Deal with Rohit", "Campaigns and live run", "Results"]);
  });

  it("maps the campaign and live pages to the same step", () => {
    expect(flowStepOfPath("/campaign")).toBe("live");
    expect(flowStepOfPath("/simulation")).toBe("live");
    expect(flowStepOfPath("/cm-pitch")).toBe("deal");
    expect(flowStepOfPath("/leaderboard")).toBeNull();
  });

  it("ticks a step only when the student really did it", () => {
    expect(FLOW_STEPS.map((s) => stepDone(s.key, start))).toEqual([false, false, false, false]);
    const dealt = { ...start, briefDone: true, dealDone: true };
    expect(FLOW_STEPS.map((s) => stepDone(s.key, dealt))).toEqual([true, true, false, false]);
    const finished = { ...dealt, runStarted: true, runDone: true };
    expect(FLOW_STEPS.map((s) => stepDone(s.key, finished))).toEqual([true, true, true, true]);
  });

  it("locks each step until the one before is done, with the reason", () => {
    expect(stepLock("brief", start)).toBeNull();
    expect(stepLock("deal", start)).toMatch(/brief/i);
    expect(stepLock("live", { ...start, briefDone: true })).toMatch(/deal/i);
    expect(stepLock("live", { ...start, briefDone: true, dealDone: true })).toBeNull();
    expect(stepLock("results", { ...start, dealDone: true, runStarted: true })).toMatch(/day 30/i);
    expect(stepLock("results", { ...start, anyRunCompleted: true })).toBeNull();
  });
});
