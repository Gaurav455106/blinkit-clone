import { describe, it, expect } from "vitest";
import {
  valueAsked, valueGiven, dealBalance, stockFit, demandShares, startNegotiation, rohitTurn, chooseOption, dealOutcome,
  MAX_COUNTERS, type NegotiationState,
} from "@/market/dealRohit";
import { defaultDeal, stockPool, validateDeal, type DealTerms } from "@/market/deal";
import { testContext } from "@/market/__tests__/testContext";
import { pct } from "@/market/events";

const fuel = testContext("fuelup");
const henlo = testContext("henlo");
const vita = testContext("vitaboost");

/** Plays Rohit with a fixed picker until the negotiation closes. */
function play(ctx: typeof fuel, sheet: DealTerms, pick: (ids: string[]) => string, maxTurns = 12): { state: NegotiationState; turns: string[] } {
  let state = startNegotiation(ctx, sheet);
  const turns: string[] = [];
  for (let i = 0; i < maxTurns; i++) {
    const turn = rohitTurn(ctx, state);
    if (!turn) break;
    turns.push(turn.kind);
    const id = pick(turn.options.map((o) => o.id));
    state = chooseOption(ctx, state, turn.options.find((o) => o.id === id)!);
  }
  return { state, turns };
}

const first = (ids: string[]) => ids[0];
const accept = (ids: string[]) => ids.find((id) => id.startsWith("accept") || id === "agree") ?? ids[0];

describe("valuation", () => {
  it("asking for more costs Rohit more; offering more gives him more", () => {
    const base = defaultDeal(fuel);
    expect(valueAsked(fuel, base)).toBe(0);
    expect(valueGiven(fuel, base)).toBe(0);
    const ask1 = { ...base, asks: [{ kind: "shelfSpot" as const }] };
    const ask2 = { ...ask1, asks: [...ask1.asks, { kind: "moreStores" as const, state: "Karnataka" }] };
    expect(valueAsked(fuel, ask2)).toBeGreaterThan(valueAsked(fuel, ask1));
    const give1 = { ...base, gives: [{ kind: "adSpend" as const, perDay: 1000, days: 14 }] };
    const give2 = { ...base, gives: [{ kind: "adSpend" as const, perDay: 2000, days: 14 }] };
    expect(valueGiven(fuel, give2)).toBeGreaterThan(valueGiven(fuel, give1));
  });

  it("more stores where few people search costs Rohit more than where many do", () => {
    const shares = demandShares(fuel);
    const states = Object.keys(shares).sort((a, b) => shares[b] - shares[a]);
    const ask = (state: string) => valueAsked(fuel, { ...defaultDeal(fuel), asks: [{ kind: "moreStores", state }] });
    // Same number of units placed in each state, so only demand differs
    const even = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, Object.fromEntries(states.map((s) => [s, u / states.length]))]));
    const evenAsk = (state: string) => valueAsked(fuel, { ...defaultDeal(fuel), stock: even, asks: [{ kind: "moreStores", state }] });
    expect(evenAsk(states[states.length - 1])).toBeGreaterThan(evenAsk(states[0]));
    expect(ask(states[0])).toBeGreaterThan(0);
  });

  it("demand shares across the brand's states add up to 100%", () => {
    expect(Object.values(demandShares(fuel)).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
  });

  it("stock fit is 1 when stock follows demand and drops when it doesn't", () => {
    const shares = demandShares(fuel);
    const follow = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, Object.fromEntries(Object.entries(shares).map(([s, w]) => [s, u * w]))]));
    expect(stockFit(fuel, { ...defaultDeal(fuel), stock: follow })).toBeCloseTo(1, 6);
    const worst = Object.keys(shares).sort((a, b) => shares[a] - shares[b])[0];
    const lopsided = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, { [worst]: u }]));
    expect(stockFit(fuel, { ...defaultDeal(fuel), stock: lopsided })).toBeLessThan(0.7);
  });
});

describe("negotiation", () => {
  it("the brief's split with nothing asked is accepted straight away, relationship 50", () => {
    const shares = demandShares(fuel);
    const follow = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, Object.fromEntries(Object.entries(shares).map(([s, w]) => [s, u * w]))]));
    const { state, turns } = play(fuel, { ...defaultDeal(fuel), stock: follow }, accept);
    expect(turns).toEqual(["accept"]);
    expect(state.status).toBe("agreed");
    expect(dealOutcome(fuel, state).relationship).toBeGreaterThanOrEqual(48);
  });

  it("asking for a lot and offering nothing gets a counter with a priced way to close the gap", () => {
    const greedy: DealTerms = { ...defaultDeal(fuel), asks: [{ kind: "shelfSpot" }, { kind: "moreStores", state: "Karnataka" }] };
    const state = startNegotiation(fuel, greedy);
    const turn = rohitTurn(fuel, state)!;
    expect(turn.kind).toBe("counter");
    const ids = turn.options.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(["dropAsk", "addSpend", "walkAway"]));
    const add = turn.options.find((o) => o.id === "addSpend")!;
    expect(add.cost).toMatch(/₹/);
    const after = chooseOption(fuel, state, add);
    expect(dealBalance(fuel, after.terms)).toBeGreaterThanOrEqual(0);
  });

  it("never counters more than the limit, and always lets the student walk away", () => {
    const greedy: DealTerms = { ...defaultDeal(fuel), asks: [{ kind: "shelfSpot" }, { kind: "fastRestock", state: "Karnataka" }] };
    // Always pick an option that keeps the gap open (never add spend or drop)
    const stubborn = (ids: string[]) => ids.find((id) => id === "insist") ?? ids.find((id) => id.startsWith("keep")) ?? ids.find((id) => id === "finalAccept") ?? ids[0];
    const { state, turns } = play(fuel, greedy, stubborn);
    expect(turns.filter((t) => t === "counter").length).toBeLessThanOrEqual(MAX_COUNTERS);
    expect(state.status === "agreed" || state.status === "walkedAway").toBe(true);
    let s = startNegotiation(fuel, greedy);
    for (let i = 0; i < 10; i++) {
      const t = rohitTurn(fuel, s);
      if (!t) break;
      expect(t.options.some((o) => o.id === "walkAway") || t.kind === "accept").toBe(true);
      s = chooseOption(fuel, s, t.options.find((o) => o.id !== "walkAway")!);
    }
  });

  it("every option shows its cost before the student picks", () => {
    const greedy: DealTerms = { ...defaultDeal(fuel), asks: [{ kind: "shelfSpot" }], gives: [{ kind: "discount", skuIds: ["fuel-1"], pct: 0.3 }] };
    let s = startNegotiation(fuel, greedy);
    for (let i = 0; i < 8; i++) {
      const t = rohitTurn(fuel, s);
      if (!t) break;
      for (const o of t.options) expect(o.cost.length).toBeGreaterThan(3);
      s = chooseOption(fuel, s, t.options[0]);
    }
  });

  it("walking away gives the brief's terms and relationship 50", () => {
    const greedy: DealTerms = { ...defaultDeal(fuel), asks: [{ kind: "shelfSpot" }, { kind: "moreStores", state: "Delhi" }] };
    const { state } = play(fuel, greedy, (ids) => (ids.includes("walkAway") ? "walkAway" : ids[0]));
    const out = dealOutcome(fuel, state);
    expect(out.terms.walkedAway).toBe(true);
    expect(out.relationship).toBe(50);
  });

  it("the agreed terms are always a valid deal sheet", () => {
    for (const ctx of [fuel, henlo, vita]) {
      const sheet: DealTerms = { ...defaultDeal(ctx), asks: [{ kind: "shelfSpot" }], gives: [{ kind: "adSpend", perDay: 3000, days: 14 }] };
      const { state } = play(ctx, sheet, first);
      expect(validateDeal(ctx, dealOutcome(ctx, state).terms)).toEqual([]);
    }
  });
});

describe("objections use the brief's own numbers", () => {
  it("stock piled where few people search: Rohit names the state and its real demand share", () => {
    const shares = demandShares(fuel);
    const worst = Object.keys(shares).sort((a, b) => shares[a] - shares[b])[0];
    const lopsided = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, { [worst]: u }]));
    const turn = rohitTurn(fuel, startNegotiation(fuel, { ...defaultDeal(fuel), stock: lopsided }))!;
    expect(turn.kind).toBe("objection:split");
    expect(turn.line).toContain(worst);
    expect(turn.chips.map((c) => c.value)).toContain(pct(shares[worst]));
  });

  it("Henlo: a discount bigger than half the margin is flagged with the real margin", () => {
    const sku = henlo.scenario.profile.skus[0];
    const sheet: DealTerms = { ...defaultDeal(henlo), gives: [{ kind: "discount", skuIds: [sku.id], pct: 0.15 }] };
    const turn = rohitTurn(henlo, startNegotiation(henlo, sheet))!;
    expect(turn.kind).toBe("objection:discount");
    expect(turn.chips.map((c) => c.value)).toContain(`₹${sku.margin.toLocaleString("en-IN")}`);
    expect(turn.chips.map((c) => c.value)).toContain(`₹${Math.round(sku.mrp * 0.15).toLocaleString("en-IN")}`);
  });

  it("VitaBoost: asking for more stores outside the main state means proving demand first", () => {
    const other = vita.scenario.profile.secondaryStates[0];
    const sheet: DealTerms = { ...defaultDeal(vita), asks: [{ kind: "moreStores", state: other }] };
    const turn = rohitTurn(vita, startNegotiation(vita, sheet))!;
    expect(turn.kind).toBe("objection:unproven");
    expect(turn.line).toContain(vita.scenario.profile.primaryState);
  });

  it("an ad-spend promise bigger than 60% of the budget is questioned", () => {
    const sheet: DealTerms = { ...defaultDeal(fuel), gives: [{ kind: "adSpend", perDay: 10000, days: 14 }] };
    const turn = rohitTurn(fuel, startNegotiation(fuel, sheet))!;
    expect(turn.kind).toBe("objection:overpromise");
    expect(turn.chips.map((c) => c.value)).toContain("70%");
  });

  it("each objection comes up once", () => {
    const sku = henlo.scenario.profile.skus[0];
    const sheet: DealTerms = { ...defaultDeal(henlo), gives: [{ kind: "discount", skuIds: [sku.id], pct: 0.15 }] };
    const { turns } = play(henlo, sheet, (ids) => ids.find((id) => id.startsWith("keep")) ?? accept(ids));
    expect(turns.filter((t) => t === "objection:discount").length).toBe(1);
  });
});

describe("relationship", () => {
  it("starts higher for a deal that gives Rohit more and fits demand, within 30 to 80", () => {
    const shares = demandShares(fuel);
    const follow = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, Object.fromEntries(Object.entries(shares).map(([s, w]) => [s, u * w]))]));
    const generous: DealTerms = { ...defaultDeal(fuel), stock: follow, gives: [{ kind: "adSpend", perDay: 4000, days: 14 }] };
    const plain: DealTerms = { ...defaultDeal(fuel), stock: follow };
    const g = dealOutcome(fuel, play(fuel, generous, accept).state).relationship;
    const p = dealOutcome(fuel, play(fuel, plain, accept).state).relationship;
    expect(g).toBeGreaterThan(p);
    for (const r of [g, p]) { expect(r).toBeGreaterThanOrEqual(30); expect(r).toBeLessThanOrEqual(80); }
  });

  it("says so plainly when the student gives something for nothing", () => {
    const shares = demandShares(fuel);
    const follow = Object.fromEntries(Object.entries(stockPool(fuel)).map(([sku, u]) => [sku, Object.fromEntries(Object.entries(shares).map(([s, w]) => [s, u * w]))]));
    const turn = rohitTurn(fuel, startNegotiation(fuel, { ...defaultDeal(fuel), stock: follow, gives: [{ kind: "adSpend", perDay: 1000, days: 14 }] }))!;
    expect(turn.kind).toBe("accept");
    expect(turn.line).toContain("asking for nothing back");
    expect(turn.line).not.toContain("₹0");
  });
});
