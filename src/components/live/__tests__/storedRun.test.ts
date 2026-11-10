import { beforeEach, describe, expect, it } from "vitest";
import { actionDayMade, readStoredRun, restoreStoredRun } from "@/components/live/useLiveRun";
import type { Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";

const student = { email: "a@x.com", name: "A", batch: "b1" } as Student;
const scenario = { seed: "henlo-1" } as Scenario;
const KEY = "sim_v2_run:a@x.com:henlo-1:run-1";

beforeEach(() => localStorage.clear());

describe("v2 run log cloud copy", () => {
  it("reads nothing before the run is stored or without a run id", () => {
    expect(readStoredRun(student, scenario, "run-1")).toBeNull();
    expect(readStoredRun(student, scenario, null)).toBeNull();
  });

  it("restores a cloud log onto a browser that has none", () => {
    expect(restoreStoredRun(student, scenario, "run-1", { daysDone: 12, actions: [] })).toBe(true);
    expect(readStoredRun(student, scenario, "run-1")?.daysDone).toBe(12);
  });

  it("keeps the local log when it has played as far or further", () => {
    localStorage.setItem(KEY, JSON.stringify({ daysDone: 15 }));
    expect(restoreStoredRun(student, scenario, "run-1", { daysDone: 12 })).toBe(false);
    expect(readStoredRun(student, scenario, "run-1")?.daysDone).toBe(15);
  });

  it("rejects cloud data that isn't a run log", () => {
    expect(restoreStoredRun(student, scenario, "run-1", { foo: 1 })).toBe(false);
    expect(restoreStoredRun(student, scenario, "run-1", null)).toBe(false);
  });
});

describe("actionDayMade", () => {
  // applyActions applies an action from the day after dayMade (dayMade < day)
  it("an edit made between days applies from tomorrow", () => {
    expect(actionDayMade(5, false)).toBe(5);
  });

  it("an edit made while day 6 is being computed applies from day 7, not day 6", () => {
    expect(actionDayMade(5, true)).toBe(6);
  });
});
