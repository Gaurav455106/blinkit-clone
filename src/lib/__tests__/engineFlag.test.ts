import { describe, it, expect, beforeEach } from "vitest";
import { engineForScenario, engineOverride, resolveEngine, NEW_BRIEF_ENGINE } from "@/lib/engineFlag";
import { generateScenario } from "@/data/scenarios";

const legacy: { engine?: "v1" | "v2" } = {};
const atBrief = { hasPitch: false, hasRun: false };

describe("which engine a brief uses", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("every new brand brief is created on v2", () => {
    expect(NEW_BRIEF_ENGINE).toBe("v2");
    expect(generateScenario().engine).toBe("v2");
    expect(engineForScenario(null, atBrief)).toBe("v2");
  });

  it("a brief keeps the engine it was stamped with", () => {
    expect(engineForScenario({ engine: "v1" }, atBrief)).toBe("v1");
    expect(engineForScenario({ engine: "v2" }, { hasPitch: true, hasRun: true })).toBe("v2");
  });

  it("an older brief stays on v1 once the student has pitched or started a run", () => {
    expect(engineForScenario(legacy, { hasPitch: true, hasRun: false })).toBe("v1");
    expect(engineForScenario(legacy, { hasPitch: false, hasRun: true })).toBe("v1");
  });

  it("an older brief the student is still reading moves to v2", () => {
    expect(engineForScenario(legacy, atBrief)).toBe("v2");
  });

  it("?engine= overrides for trainers, and is remembered in this browser", () => {
    window.history.replaceState({}, "", "/brief?engine=v1");
    expect(engineOverride()).toBe("v1");
    expect(resolveEngine({ engine: "v2" }, atBrief)).toBe("v1");
    window.history.replaceState({}, "", "/brief");
    expect(engineOverride()).toBe("v1");
    window.history.replaceState({}, "", "/brief?engine=auto");
    expect(engineOverride()).toBeNull();
    expect(resolveEngine({ engine: "v2" }, atBrief)).toBe("v2");
  });

  it("once the student has pitched or started a run, the brief's stamp beats the override", () => {
    window.history.replaceState({}, "", "/simulation?engine=v1");
    expect(resolveEngine({ engine: "v2" }, { hasPitch: true, hasRun: false })).toBe("v2");
    expect(resolveEngine({ engine: "v2" }, { hasPitch: false, hasRun: true })).toBe("v2");
    expect(resolveEngine({ engine: "v2" }, atBrief)).toBe("v1");
    window.history.replaceState({}, "", "/brief?engine=auto");
  });
});
