import { describe, expect, it } from "vitest";
import { dropScoredInProgress, scoredRunIds } from "../scoredRuns";

const entry = (id: string, status: "in_progress" | "completed") =>
  ({ id, scenarioSeed: "s", brandName: "Glow", brandEmoji: "x", startedAt: "2026-08-22", status });

describe("scoredRunIds", () => {
  it("collects the run ids saved attempts were made from", () => {
    const rows = [{ choices: { runId: "run-a" } }, { choices: {} }, { choices: null }, { choices: { runId: "run-b" } }];
    expect([...scoredRunIds(rows)].sort()).toEqual(["run-a", "run-b"]);
  });
});

describe("dropScoredInProgress", () => {
  it("drops an 'in progress' entry whose run already has a saved score", () => {
    const history = [entry("run-a", "in_progress"), entry("attempt-1", "completed"), entry("run-c", "in_progress")];
    expect(dropScoredInProgress(history, new Set(["run-a"])).map((r) => r.id)).toEqual(["attempt-1", "run-c"]);
  });

  it("returns the same list when nothing needs dropping", () => {
    const history = [entry("run-c", "in_progress")];
    expect(dropScoredInProgress(history, new Set(["run-a"]))).toBe(history);
  });
});
