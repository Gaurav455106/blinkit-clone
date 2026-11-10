import { describe, expect, it } from "vitest";
import { formatPoints } from "../points";

describe("formatPoints", () => {
  it("rounds long decimals to one place", () => {
    expect(formatPoints(2.142857142857143)).toBe("2.1");
    expect(formatPoints(1.45)).toBe("1.5");
  });

  it("drops a trailing .0 so whole numbers stay whole", () => {
    expect(formatPoints(15)).toBe("15");
    expect(formatPoints(4.96)).toBe("5");
    expect(formatPoints(0)).toBe("0");
  });

  it("keeps one decimal when it matters", () => {
    expect(formatPoints(1.5)).toBe("1.5");
  });

  it("shows nothing odd for non-numbers", () => {
    expect(formatPoints(Number.NaN)).toBe("0");
  });
});
