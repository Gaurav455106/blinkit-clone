import { describe, expect, it } from "vitest";
import { isTestRun } from "../testRuns";

describe("isTestRun", () => {
  it("is true only for the staff test batch", () => {
    expect(isTestRun({ batch_code: "MASTER" })).toBe(true);
    expect(isTestRun({ batch_code: "mlp_52_ft" })).toBe(false);
  });
});
