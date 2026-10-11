import { describe, it, expect } from "vitest";
import { hashString, mulberry32, streamFor, poisson, normal, logNormal } from "@/market/rng";

const SAMPLES = 20_000;

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function variance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
}

describe("hashString", () => {
  it("is stable and spreads similar inputs", () => {
    expect(hashString("fuelup")).toBe(hashString("fuelup"));
    expect(hashString("fuelup|1")).not.toBe(hashString("fuelup|2"));
    expect(hashString("")).toBeGreaterThanOrEqual(0);
  });
});

describe("mulberry32", () => {
  it("returns the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("stays in [0, 1) with a mean near 0.5", () => {
    const r = mulberry32(7);
    const xs = Array.from({ length: SAMPLES }, () => r());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mean(xs)).toBeCloseTo(0.5, 1);
  });
});

describe("streamFor", () => {
  it("gives each key its own independent, repeatable stream", () => {
    const a1 = streamFor("batch1", "fuelup", "whey protein", 3)();
    const a2 = streamFor("batch1", "fuelup", "whey protein", 3)();
    const b = streamFor("batch1", "fuelup", "whey protein", 4)();
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });
});

describe("poisson", () => {
  it("returns 0 for a non-positive mean", () => {
    expect(poisson(0, mulberry32(1))).toBe(0);
    expect(poisson(-3, mulberry32(1))).toBe(0);
  });

  for (const lambda of [0.5, 4, 25, 400, 20_000]) {
    it(`has mean ≈ variance ≈ ${lambda}`, () => {
      const r = mulberry32(lambda * 13 + 1);
      const xs = Array.from({ length: SAMPLES }, () => poisson(lambda, r));
      expect(xs.every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
      expect(Math.abs(mean(xs) - lambda) / lambda).toBeLessThan(0.05);
      expect(Math.abs(variance(xs) - lambda) / lambda).toBeLessThan(0.1);
    });
  }
});

describe("normal and logNormal", () => {
  it("normal has mean 0 and sd 1", () => {
    const r = mulberry32(99);
    const xs = Array.from({ length: SAMPLES }, () => normal(r));
    expect(mean(xs)).toBeCloseTo(0, 1);
    expect(Math.sqrt(variance(xs))).toBeCloseTo(1, 1);
  });

  it("logNormal has the requested median and is always positive", () => {
    const r = mulberry32(5);
    const xs = Array.from({ length: SAMPLES }, () => logNormal(300, 0.35, r)).sort((a, b) => a - b);
    expect(xs[0]).toBeGreaterThan(0);
    const median = xs[Math.floor(xs.length / 2)];
    expect(Math.abs(median - 300) / 300).toBeLessThan(0.03);
  });
});
