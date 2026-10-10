import { describe, it, expect } from "vitest";
import { relevance, CTR_HISTORY_MIN_IMPRESSIONS, RELEVANCE_MIN, RELEVANCE_MAX } from "@/market/relevance";

const CAT_CTR = 0.02;

describe("relevance (F2a)", () => {
  it("equals keyword fit when there is no CTR history yet", () => {
    expect(relevance(1.1, undefined, CAT_CTR)).toBeCloseTo(1.1, 6);
    expect(relevance(1.1, { clicks: 5, viewableImpressions: CTR_HISTORY_MIN_IMPRESSIONS - 1 }, CAT_CTR)).toBeCloseTo(1.1, 6);
  });

  it("rises with above-average CTR and falls with below-average CTR (square root)", () => {
    const vi = 10_000;
    expect(relevance(1.0, { clicks: vi * CAT_CTR * 1.44, viewableImpressions: vi }, CAT_CTR)).toBeCloseTo(1.2, 6);
    expect(relevance(1.0, { clicks: vi * CAT_CTR * 0.64, viewableImpressions: vi }, CAT_CTR)).toBeCloseTo(0.8, 6);
  });

  it("is clamped to 0.6–1.3", () => {
    const vi = 10_000;
    expect(relevance(1.3, { clicks: vi * 0.2, viewableImpressions: vi }, CAT_CTR)).toBe(RELEVANCE_MAX);
    expect(relevance(0.6, { clicks: 1, viewableImpressions: vi }, CAT_CTR)).toBe(RELEVANCE_MIN);
  });

  it("is 0 when the SKU doesn't fit the keyword at all, so it never enters", () => {
    expect(relevance(0, undefined, CAT_CTR)).toBe(0);
  });
});
