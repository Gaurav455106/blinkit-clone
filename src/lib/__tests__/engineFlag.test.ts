import { describe, it, expect, beforeEach } from "vitest";
import { briefOnLoad, engineForScenario, resolveEngine, NEW_BRIEF_ENGINE } from "@/lib/engineFlag";
import { generateScenario } from "@/data/scenarios";

const legacy: { engine?: "v1" | "v2" } = {};
const atBrief = { hasPitch: false, hasRun: false };
const pitched = { hasPitch: true, hasRun: false };
const running = { hasPitch: true, hasRun: true };

describe("everyone plays the new simulation (v2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("every new brand brief is created on v2", () => {
    expect(NEW_BRIEF_ENGINE).toBe("v2");
    expect(generateScenario().engine).toBe("v2");
  });

  it("plays v2 whatever the brief was stamped with", () => {
    expect(resolveEngine({ engine: "v1" }, running)).toBe("v2");
    expect(resolveEngine(legacy, pitched)).toBe("v2");
    expect(resolveEngine(null, atBrief)).toBe("v2");
  });

  it("ignores the old ?engine=v1 trainer switch", () => {
    window.history.replaceState({}, "", "/brief?engine=v1");
    expect(resolveEngine({ engine: "v2" }, atBrief)).toBe("v2");
  });

  it("still opens a past run's results on the engine it was played on", () => {
    expect(resolveEngine({ engine: "v1" }, running, { reviewing: true })).toBe("v1");
    expect(resolveEngine(legacy, running, { reviewing: true })).toBe("v1");
    expect(resolveEngine({ engine: "v2" }, running, { reviewing: true })).toBe("v2");
    expect(engineForScenario(legacy, atBrief)).toBe("v2");
  });
});

describe("briefOnLoad: what happens to the brief this browser holds", () => {
  it("keeps a v2 brief", () => {
    expect(briefOnLoad({ engine: "v2" }, running)).toBe("keep");
  });

  it("moves an old brief the student is only reading onto v2", () => {
    expect(briefOnLoad(legacy, atBrief)).toBe("stamp-v2");
    expect(briefOnLoad({ engine: "v1" }, atBrief)).toBe("stamp-v2");
  });

  it("replaces an old brief already pitched or running with a fresh v2 brief", () => {
    expect(briefOnLoad({ engine: "v1" }, pitched)).toBe("fresh-brief");
    expect(briefOnLoad(legacy, running)).toBe("fresh-brief");
  });
});
