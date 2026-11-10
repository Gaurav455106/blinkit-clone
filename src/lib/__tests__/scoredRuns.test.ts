import { describe, expect, it } from "vitest";
import { dropScoredInProgress, historyIdOf, isFullSnapshot, mergeRunHistory, scoredRunIds } from "../scoredRuns";

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

describe("mergeRunHistory", () => {
  const full = { scenario: { seed: "s", cityStockMap: { Delhi: 80 }, engine: "v2" } };
  const cut = { scenario: { seed: "s", profile: { id: "glow", name: "Glow" } }, engine: "v2" };
  const local = (id: string, status: "in_progress" | "completed", snapshot?: unknown) =>
    ({ ...entry(id, status), score: 59.5, snapshot }) as never;
  const cloud = (id: string, snapshot?: unknown) =>
    ({ ...entry(id, "completed"), score: 60, completedAt: "2026-11-10", snapshot }) as never;

  it("shows a finished run once, with the saved score and the full local copy", () => {
    const merged = mergeRunHistory([local("run-a", "completed", full)], [cloud("run-a", cut)]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "run-a", status: "completed", score: 60, snapshot: full });
  });

  it("uses the cloud copy when this browser has none, and keeps unrelated local runs", () => {
    const merged = mergeRunHistory([local("run-x", "in_progress", full)], [cloud("run-a", cut)]);
    expect(merged.map((r: { id: string }) => r.id)).toEqual(["run-a", "run-x"]);
  });

  it("drops a local 'in progress' copy of a run the cloud says is finished", () => {
    const merged = mergeRunHistory([local("run-a", "in_progress", full)], [cloud("run-a", cut)]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ status: "completed", snapshot: full });
  });
});

describe("isFullSnapshot", () => {
  it("is true only when the brief can be rebuilt from it", () => {
    expect(isFullSnapshot({ scenario: { seed: "s", cityStockMap: { Delhi: 80 } } })).toBe(true);
    expect(isFullSnapshot({ scenario: { seed: "s", profile: { id: "glow" } } })).toBe(false);
    expect(isFullSnapshot(undefined)).toBe(false);
  });
});

describe("historyIdOf", () => {
  it("lists a saved attempt under the run it came from", () => {
    expect(historyIdOf({ id: "attempt-1", choices: { runId: "run-a" } })).toBe("run-a");
    expect(historyIdOf({ id: "attempt-1", choices: {} })).toBe("attempt-1");
  });
});
