import { describe, it, expect } from "vitest";
import { dealValue } from "@/market/dealValueLines";
import { rohitTurn, startNegotiation, valueAsked, valueGiven } from "@/market/dealRohit";
import { allowedStates, defaultDeal, type DealTerms } from "@/market/deal";
import { testContext } from "@/market/__tests__/testContext";

const ctx = testContext("fuelup");
const [s1, s2] = allowedStates(ctx);
const sku = ctx.scenario.profile.skus[0].id;

const busy: DealTerms = {
  ...defaultDeal(ctx),
  asks: [
    { kind: "moreStores", state: s1 },
    { kind: "busyStores", state: s2 },
    { kind: "fastRestock", state: s1 },
    { kind: "shelfSpot" },
  ],
  gives: [
    { kind: "adSpend", perDay: 1500, days: 14 },
    { kind: "discount", pct: 0.1, skuIds: [sku] },
    { kind: "supply", state: s1, osaPct: 60, byDay: 15 },
  ],
};

describe("dealValue", () => {
  it("has one line per ask and offer, and the lines add up to Rohit's totals", () => {
    const v = dealValue(ctx, busy);
    expect(v.asks).toHaveLength(4);
    expect(v.gives).toHaveLength(3);
    expect(v.asked).toBeCloseTo(valueAsked(ctx, busy), 6);
    expect(v.given).toBeCloseTo(valueGiven(ctx, busy), 6);
    expect(v.balance).toBeCloseTo(v.given - v.asked, 6);
  });

  it("explains that promised ad spend counts at 60%", () => {
    const ad = dealValue(ctx, busy).gives[0];
    expect(ad.value).toBe(1500 * 14 * 0.6);
    expect(ad.how).toContain("₹21,000");
    expect(ad.how).toContain("60%");
  });

  it("names the state and the working for each ask", () => {
    const [more, busyStores, restock, shelf] = dealValue(ctx, busy).asks;
    expect(more.label).toBe(`More stores in ${s1}`);
    expect(more.how).toMatch(/30% more of your .* units/);
    expect(busyStores.how).toContain(`how busy ${s2} is`);
    expect(restock.how).toContain("minimum of ₹5,000");
    expect(shelf.value).toBe(15000);
  });

  it("is empty and balanced for a deal with no asks or offers", () => {
    const v = dealValue(ctx, defaultDeal(ctx));
    expect(v).toMatchObject({ asks: [], gives: [], asked: 0, given: 0, balance: 0 });
  });

  it("explains when an ask costs more than on the deal sheet because stock moved into its state", () => {
    const sent: DealTerms = { ...defaultDeal(ctx), asks: [{ kind: "moreStores", state: s1 }, { kind: "shelfSpot" }] };
    const moved: DealTerms = { ...sent, stock: { ...sent.stock, [sku]: { ...sent.stock[sku], [s1]: (sent.stock[sku][s1] ?? 0) + 50 } } };
    const [more, shelf] = dealValue(ctx, moved, sent).asks;
    expect(more.change).toMatch(new RegExp(`^Up from ₹[\\d,]+ on your deal sheet, because [\\d,]+ of your units now sit in ${s1}, not [\\d,]+\\.$`));
    expect(shelf.change).toBeUndefined();
    expect(dealValue(ctx, sent, sent).asks.every((l) => !l.change)).toBe(true);
    expect(dealValue(ctx, moved).asks.every((l) => !l.change)).toBe(true);
  });
});

describe("Rohit's ad spend counter", () => {
  const counterFor = (terms: DealTerms) =>
    rohitTurn(ctx, { ...startNegotiation(ctx, terms), handled: ["split", "discount", "unproven", "overpromise"] })!;

  it("says the new promise replaces the old one, with the per-day amount", () => {
    const short: DealTerms = { ...defaultDeal(ctx), asks: [{ kind: "shelfSpot" }], gives: [{ kind: "adSpend", perDay: 500, days: 14 }] };
    const turn = counterFor(short);
    expect(turn.kind).toBe("counter");
    const add = turn.options.find((o) => o.id === "addSpend")!;
    expect(add.label).toMatch(/^Raise your ad promise from ₹7,000 to ₹[\d,]+ \(₹[\d,]+ a day for 14 days\)$/);
    expect(add.cost).toMatch(/^₹[\d,]+ more ad spend you must actually spend by day 14$/);
  });

  it("offers a fresh promise when none was made", () => {
    const short: DealTerms = { ...defaultDeal(ctx), asks: [{ kind: "shelfSpot" }] };
    const add = counterFor(short).options.find((o) => o.id === "addSpend")!;
    expect(add.label).toMatch(/^Promise ₹[\d,]+ of ad spend \(₹[\d,]+ a day for 14 days\)$/);
  });
});
