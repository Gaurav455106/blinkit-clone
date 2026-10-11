import { describe, it, expect } from "vitest";
import { dealPitchResult } from "@/lib/dealPitch";
import { defaultDeal, walkAwayDeal, stockPool } from "@/market/deal";
import { testContext } from "@/market/__tests__/testContext";

const fuel = testContext("fuelup");

describe("dealPitchResult", () => {
  it("lists every stocked product and state, so the wizard shows what can sell", () => {
    const r = dealPitchResult(fuel, { terms: defaultDeal(fuel), relationship: 55, log: [] });
    expect(r.approvedSKUs).toEqual(["fuel-1", "fuel-2", "fuel-3"]);
    expect(new Set(r.approvedCities)).toEqual(new Set(["Karnataka", "Maharashtra", "Delhi"]));
    expect(r.status).toBe("decent");
  });

  it("drops a product the student gave no stock", () => {
    const d = defaultDeal(fuel);
    const r = dealPitchResult(fuel, { terms: { ...d, stock: { ...d.stock, "fuel-3": {} } }, relationship: 70, log: [] });
    expect(r.approvedSKUs).not.toContain("fuel-3");
    expect(r.status).toBe("strong");
    expect(r.pitchScore).toBe(12);
  });

  it("a walk-away keeps the brief and is marked", () => {
    const r = dealPitchResult(fuel, { terms: walkAwayDeal(fuel), relationship: 50, log: [] });
    expect(r.flags).toContain("walked_away");
    expect(Object.keys(stockPool(fuel))).toEqual(r.approvedSKUs);
  });
});
