import { describe, it, expect } from "vitest";
import { dealLine } from "@/market/scoringV2";
import { defaultDeal, stockPool, walkAwayDeal, type DealTerms, type OpeningDeal } from "@/market/deal";
import { demandShares } from "@/market/dealRohit";
import { testContext } from "@/market/__tests__/testContext";

const fuel = testContext("fuelup");
const henlo = testContext("henlo");

function follow(ctx: typeof fuel) {
  const shares = demandShares(ctx);
  return Object.fromEntries(Object.entries(stockPool(ctx)).map(([sku, u]) => [sku, Object.fromEntries(Object.entries(shares).map(([s, w]) => [s, u * w]))]));
}
const agreed = (terms: DealTerms, relationship = 60): OpeningDeal => ({ terms, relationship, log: [] });

describe("Deal with Rohit (5 points)", () => {
  it("stock where people search and a fair trade scores full marks", () => {
    // Shelf spot (₹15,000 to Rohit) for ₹25,000 of promised ads (₹15,000 credited)
    const l = dealLine(fuel, agreed({ ...defaultDeal(fuel), stock: follow(fuel), asks: [{ kind: "shelfSpot" }], gives: [{ kind: "adSpend", perDay: 2500, days: 10 }] }));
    expect(l).toMatchObject({ key: "v2_rohit", label: "Deal with Rohit", max: 5, earned: 5 });
    expect(l.note).toContain("₹15,000");
  });

  it("stock piled where few people search loses the stock points", () => {
    const shares = demandShares(fuel);
    const worst = Object.keys(shares).sort((a, b) => shares[a] - shares[b])[0];
    const lopsided = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, { [worst]: u }]));
    const l = dealLine(fuel, agreed({ ...defaultDeal(fuel), stock: lopsided }));
    expect(l.earned).toBeLessThanOrEqual(1);
    expect(l.note).toMatch(/where people search/);
  });

  it("giving Rohit something for nothing scores 0 for the trade", () => {
    const l = dealLine(fuel, agreed({ ...defaultDeal(fuel), stock: follow(fuel), gives: [{ kind: "adSpend", perDay: 2000, days: 14 }] }));
    expect(l.earned).toBeCloseTo(2.5, 6);
    expect(l.note).toMatch(/nothing back/);
  });

  it("a discount bigger than the margin caps the trade points, with the numbers", () => {
    const sku = henlo.scenario.profile.skus[0];
    const l = dealLine(henlo, agreed({ ...defaultDeal(henlo), stock: follow(henlo), asks: [{ kind: "shelfSpot" }], gives: [{ kind: "discount", skuIds: [sku.id], pct: 0.2 }] }));
    expect(l.earned).toBeLessThanOrEqual(3);
    expect(l.note).toContain(`₹${sku.margin}`);
  });

  it("walking away keeps the stock points from the brief's split and 1 point for playing safe", () => {
    const l = dealLine(fuel, agreed(walkAwayDeal(fuel), 50));
    expect(l.note).toMatch(/walked away/i);
    expect(l.earned).toBeGreaterThanOrEqual(1);
    expect(l.earned).toBeLessThanOrEqual(3.5);
  });

  it("explains every tier and uses no em dashes", () => {
    const l = dealLine(fuel, agreed(defaultDeal(fuel)));
    expect(l.tiers.length).toBeGreaterThanOrEqual(3);
    expect(`${l.note} ${l.judgedOn} ${l.howToImprove} ${l.tiers.map((t) => t.rule).join(" ")}`).not.toContain("—");
  });
});
