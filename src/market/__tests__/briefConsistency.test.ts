// The brand brief is the source of truth: the engine's busiest hours must sit
// inside the peak hours each brief tells students (scenarios.ts peakHours).

import { describe, it, expect } from "vitest";
import { MARKET_DATA } from "@/market/data";
import { BRAND_PROFILES } from "@/data/scenarios";
import { peakSlotOf } from "@/market/momentHelpers";
import { testContext } from "./testContext";

/** Slots (0 = 12–3 AM … 7 = 9 PM–12 AM) covered by each brief's peakHours text. */
const BRIEF_PEAK_SLOTS: Record<string, number[]> = {
  henlo: [2, 6],        // "7-10 AM and 6-9 PM"
  glow: [2, 3, 6, 7],   // "8-11 AM and 7-10 PM"
  vitaboost: [2],       // "6-9 AM"
  tinybuddy: [3, 4],    // "9 AM-1 PM, not evening"
  munchbox: [5, 6, 7],  // "5 PM-10 PM"
  pawlife: [3, 4, 5],   // "10 AM-6 PM"
  fuelup: [2, 6],       // "5-8 AM and 6-9 PM"
};

describe("engine hours agree with the brand brief", () => {
  it("covers every brand", () => {
    expect(Object.keys(BRIEF_PEAK_SLOTS).sort()).toEqual(Object.keys(MARKET_DATA).sort());
  });

  for (const p of BRAND_PROFILES) {
    it(`${p.id}: busiest slot is inside "${p.peakHours}"`, () => {
      expect(BRIEF_PEAK_SLOTS[p.id]).toContain(peakSlotOf(testContext(p.id)));
    });
  }
});
