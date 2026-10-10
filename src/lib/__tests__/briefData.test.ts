import { describe, it, expect } from "vitest";
import { BRAND_PROFILES } from "@/data/scenarios";
import { MARKET_DATA } from "@/market/data";
import { testContext } from "@/market/__tests__/testContext";
import {
  breakEvenRoas, skuEconomics, breakEvenRange, workedExample, stakeholderTargets, stakeholderView,
  comparePrice, archetypeLabel, lastMonthSov, briefRivals, stateDemandRows, keywordRows,
  FINANCE_BUFFER, BRAND_HEAD_SOV_TARGET, shoppingHours, plainText,
} from "@/lib/briefData";

const profile = (id: string) => BRAND_PROFILES.find((b) => b.id === id)!;

describe("break-even ROAS", () => {
  it("is MRP divided by contribution per unit", () => {
    expect(breakEvenRoas({ mrp: 1299, margin: 400 })).toBeCloseTo(3.2475, 4);
    expect(breakEvenRoas({ mrp: 99, margin: 15 })).toBeCloseTo(6.6, 4);
  });

  it("is Infinity when contribution is zero or negative", () => {
    expect(breakEvenRoas({ mrp: 100, margin: 0 })).toBe(Infinity);
  });

  it("gives one row per SKU with margin % and break-even", () => {
    const rows = skuEconomics(profile("fuelup"));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: "fuel-1", mrp: 1299, margin: 400, velocity: "Low" });
    expect(rows[0].marginPct).toBeCloseTo(400 / 1299, 4);
    expect(rows[2].breakEven).toBeCloseTo(6.6, 4);
  });

  it("reports the lowest and highest break-even across SKUs", () => {
    const r = breakEvenRange(profile("fuelup"));
    expect(r.min).toBeCloseTo(1299 / 400, 4);
    expect(r.max).toBeCloseTo(6.6, 4);
  });
});

describe("worked example", () => {
  it("uses the first SKU and ₹1,000 of ad spend", () => {
    const ex = workedExample(profile("henlo"));
    expect(ex.skuName).toBe("Henlo Chicken Jerky Treats 150g");
    expect(ex.adSpend).toBe(1000);
    expect(ex.unitsToBreakEven).toBeCloseTo(1000 / 45, 4);
    expect(ex.revenueToBreakEven).toBeCloseTo((1000 / 45) * 299, 4);
    expect(ex.breakEven).toBeCloseTo(299 / 45, 4);
    // revenue ÷ spend is the break-even ROAS
    expect(ex.revenueToBreakEven / ex.adSpend).toBeCloseTo(ex.breakEven, 6);
  });
});

describe("stakeholder targets", () => {
  it("finance asks for the blended break-even × 1.1, rounded to 0.1", () => {
    const p = profile("fuelup");
    const blended = p.skus.reduce((s, k) => s + k.mrp, 0) / p.skus.reduce((s, k) => s + k.margin, 0);
    const t = stakeholderTargets(p);
    expect(t.blendedBreakEven).toBeCloseTo(blended, 6);
    expect(t.financeRoas).toBe(Math.round(blended * FINANCE_BUFFER * 10) / 10);
    expect(t.brandHeadSovPct).toBe(BRAND_HEAD_SOV_TARGET * 100);
  });

  it("finance's ROAS target is always above the blended break-even", () => {
    for (const p of BRAND_PROFILES) {
      const t = stakeholderTargets(p);
      expect(t.financeRoas).toBeGreaterThan(t.blendedBreakEven);
    }
  });

  it("writes a view for every goal type that names both targets", () => {
    const goals = ["ROAS-First", "Awareness-First", "Category-Creation", "Volume-First", "Inventory-Clearance"] as const;
    const t = stakeholderTargets(profile("glow"));
    for (const g of goals) {
      const v = stakeholderView(g, t);
      expect(v.finance.ask).toContain(t.financeRoas.toFixed(1));
      expect(v.brandHead.ask).toContain("30%");
      expect(v.tension.length).toBeGreaterThan(20);
    }
  });
});

describe("rival price comparison", () => {
  const skus = [{ name: "Chips", mrp: 49 }, { name: "Makhana", mrp: 149 }, { name: "Nuts", mrp: 249 }];

  it("compares with the student's SKU closest in price", () => {
    const c = comparePrice(129, skus);
    expect(c.skuName).toBe("Makhana");
    expect(c.diffPct).toBeCloseTo((129 - 149) / 149, 6);
    expect(c.label).toBe("13% cheaper");
  });

  it("labels pricier rivals", () => {
    expect(comparePrice(279, skus).label).toBe("12% pricier");
  });

  it("calls prices within 5% about the same", () => {
    expect(comparePrice(152, skus).label).toBe("About the same");
  });
});

describe("rivals", () => {
  it("names archetypes in plain words", () => {
    expect(archetypeLabel("leader")).toBe("Market leader");
    expect(archetypeLabel("price_warrior")).toBe("Discount brand");
  });

  it("gives last-month SOV from target SOV, and zero for rivals not yet in the market", () => {
    const ironwhey = MARKET_DATA.fuelup.rivals.find((r) => r.id === "ironwhey")!;
    expect(lastMonthSov(ironwhey)).toBe(37);
    const vitaleaf = MARKET_DATA.vitaboost.rivals.find((r) => r.id === "vitaleaf")!;
    expect(lastMonthSov(vitaleaf)).toBe(0);
  });

  it("leaves out rivals who only launch mid-run (a surprise, not a brief fact)", () => {
    const names = briefRivals(profile("vitaboost"), MARKET_DATA.vitaboost).map((r) => r.name);
    expect(names).not.toContain("VitaLeaf");
    expect(names).toContain("NutriCore");
  });

  it("sorts rivals by last-month SOV, biggest first", () => {
    const sov = briefRivals(profile("fuelup"), MARKET_DATA.fuelup).map((r) => r.lastMonthSovPct);
    expect(sov).toEqual([...sov].sort((a, b) => b - a));
  });
});

describe("state demand rows", () => {
  it("lists only stocked states with demand share and OSA, biggest demand first", () => {
    const ctx = testContext("fuelup");
    const rows = stateDemandRows(ctx.scenario, ctx.market);
    expect(rows.map((r) => r.state).sort()).toEqual(["Delhi", "Karnataka", "Maharashtra"]);
    for (const r of rows) {
      expect(r.osa).toBe(ctx.scenario.cityStockMap[r.state]);
      expect(r.demandShare).toBeGreaterThan(0);
      expect(r.demandShare).toBeLessThan(1);
    }
    const shares = rows.map((r) => r.demandShare);
    expect(shares).toEqual([...shares].sort((a, b) => b - a));
    expect(rows.some((r) => "roas" in r)).toBe(false);
  });
});

describe("keyword rows", () => {
  it("has every market keyword with tier, monthly searches and a CPM range ≥ ₹200", () => {
    const ctx = testContext("munchbox");
    const rows = keywordRows(ctx);
    expect(rows).toHaveLength(MARKET_DATA.munchbox.keywords.length);
    for (const r of rows) {
      expect(["head", "mid", "long"]).toContain(r.tier);
      expect(r.monthlySearches).toBeGreaterThan(0);
      expect(r.cpmRange.lo).toBeGreaterThanOrEqual(200);
      expect(r.cpmRange.hi).toBeGreaterThanOrEqual(r.cpmRange.lo);
    }
  });

  it("orders head, then mid, then long-tail, by volume within a tier", () => {
    const rows = keywordRows(testContext("fuelup"));
    const order = { head: 0, mid: 1, long: 2 } as const;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      expect(order[a.tier] < order[b.tier] || (a.tier === b.tier && a.monthlySearches >= b.monthlySearches)).toBe(true);
    }
  });

  it("flags the v1 high-intent and risky keywords", () => {
    const rows = keywordRows(testContext("munchbox"));
    expect(rows.find((r) => r.term === "chips")?.v1).toBe("risky");
    expect(rows.find((r) => r.term === "roasted makhana")?.v1).toBe("good");
  });
});

describe("shopping hours (from the category's slot data)", () => {
  it("puts FuelUp's busiest slot at 6 to 9 PM with a 6 to 9 AM gym slot next", () => {
    const h = shoppingHours(MARKET_DATA.fuelup.category);
    expect(h.busiest.label).toBe("6 to 9 PM");
    expect(h.busiest.share).toBeCloseTo(0.3, 6);
    expect(h.runnersUp.map((s) => s.label)).toContain("6 to 9 AM");
    expect(h.bestConverting.label).toBe("6 to 9 PM");
  });

  it("puts TinyBuddy's busiest slot at 9 AM to 12 PM", () => {
    expect(shoppingHours(MARKET_DATA.tinybuddy.category).busiest.label).toBe("9 AM to 12 PM");
  });

  it("puts MunchBox and Glow Republic's busiest slot at 9 PM to 12 AM", () => {
    expect(shoppingHours(MARKET_DATA.munchbox.category).busiest.label).toBe("9 PM to 12 AM");
    expect(shoppingHours(MARKET_DATA.glow.category).busiest.label).toBe("9 PM to 12 AM");
  });

  it("returns all 8 slots in order with shares that sum to 1", () => {
    const h = shoppingHours(MARKET_DATA.henlo.category);
    expect(h.slots).toHaveLength(8);
    expect(h.slots[0].label).toBe("12 to 3 AM");
    expect(h.slots.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6);
    expect(h.quiet.length).toBeGreaterThan(0);
    expect(h.quiet.every((s) => s.share < 0.05)).toBe(true);
  });
});

describe("plainText", () => {
  it("turns a spaced em dash into a full stop and a capital", () => {
    expect(plainText("metros — demand is hyperlocal")).toBe("metros. Demand is hyperlocal");
  });

  it("turns number ranges into hyphens", () => {
    expect(plainText("You need 25–35% higher bids")).toBe("You need 25-35% higher bids");
  });

  it("leaves no em or en dashes", () => {
    expect(plainText("a—b – c")).not.toMatch(/[—–]/);
  });
});
