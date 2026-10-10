// Pins the v1 pitch logic (what SimContext stores) while the copy is rewritten.

import { describe, it, expect } from "vitest";
import {
  buildPushbacks, buildOpeningMessage, calcFinalResult, buildClosingMessage,
  pitchScoreToRelationship, relationshipTier, type PitchedSKU,
} from "@/lib/cmPitchLogic";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS, type Scenario, type CityStockMap, type InventoryState } from "@/data/scenarios";

const profile = BRAND_PROFILES.find((b) => b.id === "henlo")!;
const empty = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);

function scenario(over: { inventory?: Partial<InventoryState>; market?: string } = {}): Scenario {
  return {
    seed: "t", profile,
    cityStockMap: { ...empty, Karnataka: 82, Maharashtra: 70, Telangana: 55 },
    season: SEASONS.find((x) => x.name === "Normal Week")!,
    market: MARKET_CONDITIONS.find((x) => x.name === (over.market ?? "Stable Market"))!,
    inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy", ...over.inventory },
    budget: 200000,
    clientGoals: { primary: "", performanceGoals: [], reachGoals: [], metrics: [], threshold: "", lifecycle: "Convert", campaignHint: "" },
    scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "" },
    city: profile.primaryState,
  };
}

function sku(i: number, cities: string[], reasoning = "Cross-sell driver with hero SKU", extra: Partial<PitchedSKU> = {}): PitchedSKU {
  const s = profile.skus[i];
  return { skuId: s.id, skuName: s.name, velocity: s.velocity, mrp: s.mrp, margin: s.margin, reasoning, justification: "", cities, ...extra };
}

describe("cmPitchLogic (v1 behaviour kept)", () => {
  it("a clean pitch has no pushbacks and tops out at decent (base score 9)", () => {
    const pitched = [sku(0, ["Karnataka"]), sku(1, ["Karnataka"])];
    expect(buildPushbacks(pitched, scenario())).toEqual([]);
    const r = calcFinalResult(pitched, scenario(), [], {});
    expect(r).toMatchObject({ status: "decent", pitchScore: 9, osaBoost: false, approvedSKUs: ["henlo-1", "henlo-2"], approvedCities: ["Karnataka"] });
  });

  it("zero-stock states raise a pushback first, and a strong reply lifts the score", () => {
    const pitched = [sku(0, ["Karnataka", "Delhi"])];
    const pbs = buildPushbacks(pitched, scenario());
    expect(pbs[0].id).toBe("zero_stock");
    const strong = pbs[0].responses.find((r) => r.quality === "strong")!;
    expect(strong.key).toBe("remove");
    const r = calcFinalResult(pitched, scenario(), pbs, { zero_stock: "remove" });
    expect(r.pitchScore).toBe(10);
    expect(r.status).toBe("decent");
    expect(r.approvedCities).toEqual(["Karnataka"]);
    expect(r.flags).toHaveLength(1);
  });

  it("every reply has a quality, a score impact and a visible cost", () => {
    const pitched = [
      sku(2, ["Karnataka", "Delhi", "Goa", "Kerala", "Punjab", "Gujarat", "Bihar", "Assam", "Odisha", "Haryana"], "Proven high velocity offline"),
      sku(0, ["Karnataka"], ""),
    ];
    const pbs = buildPushbacks(pitched, scenario({ inventory: { tone: "critical", osa: 45, fillRate: 60 }, market: "Aggressive Competitor" }));
    expect(pbs.length).toBe(3);
    pbs.forEach((pb) => {
      expect(pb.responses).toHaveLength(3);
      expect(pb.dataCard.rows.length).toBeGreaterThan(0);
      pb.responses.forEach((r) => {
        expect(r.cost.length).toBeGreaterThan(0);
        expect({ strong: 3, ok: 1, weak: -1 }[r.quality]).toBe(r.scoreImpact);
        expect(`${r.text} ${r.cost} ${r.cmAck}`).not.toContain("—");
      });
      expect(pb.cmMessage).not.toContain("—");
    });
  });

  it("committed stock with a firm timeline approves the new state", () => {
    const pitched = [sku(0, ["Karnataka", "Delhi"], "New market expansion", { stockCommitments: { Delhi: 200 } })];
    const pbs = buildPushbacks(pitched, scenario());
    const r = calcFinalResult(pitched, scenario(), pbs, { zero_stock: "firm_timeline" });
    expect(r.approvedCities.sort()).toEqual(["Delhi", "Karnataka"]);
  });

  it("an empty pitch is rejected", () => {
    const r = calcFinalResult([], scenario(), [], {});
    expect(r.status).toBe("rejected");
    expect(buildOpeningMessage([], scenario()).message.length).toBeGreaterThan(0);
    expect(buildClosingMessage(r, "Henlo")).not.toContain("—");
  });

  it("keeps the relationship bootstrap that SimContext uses", () => {
    expect([15, 12, 11, 8, 7, 4, 3, 0].map(pitchScoreToRelationship)).toEqual([72, 72, 52, 52, 32, 32, 15, 15]);
    expect(relationshipTier(72)).toBe("trusted");
    expect(relationshipTier(15)).toBe("broken");
  });
});
