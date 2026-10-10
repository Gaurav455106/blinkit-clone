/**
 * SKU unit economics (SPEC.md §3.9 #1, decision Q17).
 *
 * `margin` is contribution per unit in ₹, after Blinkit commission and before
 * ads. Break-even ROAS = MRP ÷ margin. Most SKUs must break even at 2.5–5 so
 * good campaigns can be profitable; a few are deliberately thin because their
 * trap is "this SKU loses money on ads" (SPEC §3.10, §3.11).
 */

import { describe, it, expect } from "vitest";
import { BRAND_PROFILES } from "@/data/scenarios";

const NORMAL_RANGE: [number, number] = [2.5, 5.0];

/** Deliberately thin SKUs and the break-even range each must stay in. */
const THIN_SKUS: Record<string, [number, number]> = {
  "henlo-1": [6, 8],
  "henlo-2": [6, 8],
  "henlo-3": [6, 8],
  "munch-2": [5.5, 7],
  "fuel-3":  [6, 7],
};

const breakEven = (mrp: number, margin: number) => mrp / margin;

describe("SKU unit economics", () => {
  for (const brand of BRAND_PROFILES) {
    for (const sku of brand.skus) {
      const [lo, hi] = THIN_SKUS[sku.id] ?? NORMAL_RANGE;
      it(`${sku.id} breaks even between ${lo} and ${hi}`, () => {
        expect(sku.margin).toBeGreaterThan(0);
        const be = breakEven(sku.mrp, sku.margin);
        expect(be).toBeGreaterThanOrEqual(lo);
        expect(be).toBeLessThanOrEqual(hi);
      });
    }
  }

  it("every brand's unitEconomics text quotes its real average margin", () => {
    for (const brand of BRAND_PROFILES) {
      const avg = Math.round(brand.skus.reduce((s, k) => s + k.margin, 0) / brand.skus.length);
      expect(brand.unitEconomics).toContain(`Avg Margin ₹${avg}`);
    }
  });

  it("each hero-trap brand has one thin SKU and at least one healthy one", () => {
    for (const id of ["henlo", "munchbox", "fuelup"]) {
      const brand = BRAND_PROFILES.find((b) => b.id === id)!;
      const bes = brand.skus.map((s) => breakEven(s.mrp, s.margin));
      expect(Math.max(...bes) - Math.min(...bes)).toBeGreaterThan(id === "henlo" ? 1 : 2);
    }
  });
});
