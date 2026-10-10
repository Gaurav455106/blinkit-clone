import { describe, it, expect } from "vitest";
import {
  ROHIT_ASKS, askDef, pickCheckIns, eligibleAsks, clusterOpening, currentOsa, checkCommitments, commitmentFor,
  relationshipChange, isCheckInDay, MAX_CHECKINS_PER_RUN, COFUND_BANNER_COST,
  type AskId, type Commitment, type RohitInput,
} from "@/market/rohit";
import { pct } from "@/market/events";
import { testContext } from "@/market/__tests__/testContext";
import { cell, rivalRow, stockRow, dayResult, stateAt, campaign, historyOf } from "@/market/__tests__/liveFixtures";
import { initialUnits } from "@/market/stock";
import { stepDay } from "@/market/step";
import { initialMarketState } from "@/market/state";
import { mulberry32 } from "@/market/rng";
import { CITY_STORE_COUNT } from "@/data/scenarios";
import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";

const fuel = testContext("fuelup");
const KA_STORES = CITY_STORE_COUNT.Karnataka;

function input(ctx: MarketContext, state: MarketState, extra: Partial<RohitInput> = {}): RohitInput {
  return { ctx, state, history: [], campaigns: [campaign()], relationship: 50, ...extra };
}

/** fuel-1 at the given OSA in Karnataka, everything else as at the start. */
function withOsa(ctx: MarketContext, osaPct: number, day = 8, extra: Partial<MarketState> = {}): MarketState {
  const base = stateAt(ctx, day, extra);
  return { ...base, stock: { ...base.stock, "fuel-1": { ...base.stock["fuel-1"], Karnataka: initialUnits(osaPct, KA_STORES, "Low") } } };
}

describe("restock ask", () => {
  it("fires when OSA < 50% in a targeted state, and its chips show the state's numbers", () => {
    const state = withOsa(fuel, 42);
    const ask = askDef("restock")!;
    const inp = input(fuel, state, { campaigns: [campaign({ geography: "select_cities", cities: ["Karnataka"] })] });
    expect(ask.precondition(inp)).toBe(true);
    const built = ask.build(inp);
    const osaChip = built.chips.find((c) => c.label.includes("OSA"))!;
    expect(osaChip.label).toBe("Stores with stock (OSA), Karnataka");
    expect(osaChip.value).toBe(pct(currentOsa(fuel, state, "fuel-1", "Karnataka")));
    expect(osaChip.value).toBe("42%");
    expect(built.chips.find((c) => c.label === "Units left")!.value).toBe(Math.round(state.stock["fuel-1"].Karnataka).toLocaleString("en-IN"));
    expect(built.line).toContain("42%");
    expect(built.options.find((o) => o.id === "expedite")!.commitment?.kind).toBe("osa_at_least");
  });

  it("does not fire when the low state isn't targeted or OSA is healthy", () => {
    const delhiOnly = [campaign({ geography: "select_cities", cities: ["Delhi"] })];
    expect(askDef("restock")!.precondition(input(fuel, withOsa(fuel, 42), { campaigns: delhiOnly }))).toBe(false);
    expect(askDef("restock")!.precondition(input(fuel, withOsa(fuel, 80)))).toBe(false);
  });
});

describe("other asks: preconditions and chips", () => {
  it("co-fund banner needs healthy OSA and strong sell-through", () => {
    const base = stateAt(fuel, 8);
    const units = base.stock["fuel-1"].Karnataka;
    const sales = Array(7).fill((units * 0.5) / 7);
    const state = { ...base, salesWindow: { "fuel-1|Karnataka": sales } };
    const ka = [campaign({ geography: "select_cities", cities: ["Karnataka"] })];
    const yes = input(fuel, state, { campaigns: ka });
    expect(askDef("cofund_banner")!.precondition(yes)).toBe(true);
    const built = askDef("cofund_banner")!.build(yes);
    expect(built.chips.find((c) => c.label.includes("sell-through"))!.value).toBe("50%");
    expect(built.options[0].effect.cost).toBe(COFUND_BANNER_COST);
    const slow = { ...base, salesWindow: { "fuel-1|Karnataka": Array(7).fill(1) } };
    expect(askDef("cofund_banner")!.precondition(input(fuel, slow, { campaigns: ka }))).toBe(false);
    expect(askDef("cofund_banner")!.precondition(input(fuel, { ...withOsa(fuel, 60), salesWindow: state.salesWindow }, { campaigns: ka }))).toBe(false);
  });

  it("match discount follows the rival's price-cut day and shared keywords", () => {
    const shared = [campaign({ keywords: [{ term: "protein powder", exactBid: 400 }] })];
    expect(askDef("match_discount")!.precondition(input(fuel, stateAt(fuel, 13), { campaigns: shared }))).toBe(true);
    expect(askDef("match_discount")!.precondition(input(fuel, stateAt(fuel, 11), { campaigns: shared }))).toBe(false);
    expect(askDef("match_discount")!.precondition(input(fuel, stateAt(fuel, 13)))).toBe(false);
    const built = askDef("match_discount")!.build(input(fuel, stateAt(fuel, 13), { campaigns: shared }));
    expect(built.line).toContain("ProFit Basics");
    expect(built.chips[0].value).toBe("₹899 → ₹764");
    const low = askDef("match_discount")!.build(input(fuel, stateAt(fuel, 13), { campaigns: shared, relationship: 30 }));
    expect(low.options.find((o) => o.id === "cofund")!.quality).toBe("weak");
  });

  it("SOV threat reads the student's and the top rival's share of ad views", () => {
    const day = (d: number) => dayResult(d, {
      cells: [cell({ term: "whey protein", viewableImpressions: 14, totalAdViewable: 100 })],
      rivals: [rivalRow({ rivalId: "ironwhey", term: "whey protein", viewableImpressions: 41, totalAdViewable: 100 })],
    });
    const inp = input(fuel, stateAt(fuel, 6), { history: historyOf(6, 3, day) });
    expect(askDef("sov_threat")!.precondition(inp)).toBe(true);
    const built = askDef("sov_threat")!.build(inp);
    expect(built.chips[0]).toMatchObject({ label: 'Your share of ad views (SOV) on "whey protein"', value: "14%" });
    expect(built.chips[1]).toMatchObject({ label: "IronWhey's share of ad views", value: "41%" });
    const strong = (d: number) => dayResult(d, { cells: [cell({ term: "whey protein", viewableImpressions: 40, totalAdViewable: 100 })] });
    expect(askDef("sov_threat")!.precondition(input(fuel, stateAt(fuel, 6), { history: historyOf(6, 3, strong) }))).toBe(false);
  });

  it("overstock clearance needs an overstocked scenario and shows its aging units", () => {
    const over = { ...fuel, scenario: { ...fuel.scenario, inventory: { ...fuel.scenario.inventory, tone: "overstocked" as const, agingUnits: 1240 } } };
    expect(askDef("overstock_clearance")!.precondition(input(over, stateAt(over, 8)))).toBe(true);
    expect(askDef("overstock_clearance")!.precondition(input(fuel, stateAt(fuel, 8)))).toBe(false);
    expect(askDef("overstock_clearance")!.build(input(over, stateAt(over, 8))).chips[0].value).toBe("1,240");
  });

  it("new dark stores: a seeded unstocked state, asked only before it opens, with its stock as an effect", () => {
    const c = clusterOpening(fuel)!;
    expect(fuel.scenario.cityStockMap[c.state as keyof typeof fuel.scenario.cityStockMap]).toBe(0);
    expect(c.openDay - c.announceDay).toBe(5);
    expect(clusterOpening(testContext("fuelup"))).toEqual(c);
    const inp = input(fuel, stateAt(fuel, c.announceDay - 1));
    expect(askDef("new_dark_stores")!.precondition(inp)).toBe(true);
    expect(askDef("new_dark_stores")!.precondition(input(fuel, stateAt(fuel, c.openDay - 1)))).toBe(false);
    expect(askDef("new_dark_stores")!.precondition(input(fuel, stateAt(fuel, c.announceDay - 2)))).toBe(false);
    const built = askDef("new_dark_stores")!.build(inp);
    expect(built.situationEffect?.addStock).toEqual({ state: c.state, units: c.units, fromDay: c.openDay });
    expect(built.chips[0].value).toBe(String(CITY_STORE_COUNT[c.state as keyof typeof CITY_STORE_COUNT]));
    expect(built.chips.find((x) => x.label === "Your ads already reach it")!.value).toBe("Yes");
  });

  it("ROAS below break-even needs 3 losing days and shows the loss", () => {
    const losing = (d: number) => dayResult(d, { cells: [cell({ spend: 1000, contribution: 600, directRevenue: 2000 })] });
    const inp = input(fuel, stateAt(fuel, 7), { history: historyOf(7, 3, losing) });
    expect(askDef("roas_below_breakeven")!.precondition(inp)).toBe(true);
    const built = askDef("roas_below_breakeven")!.build(inp);
    expect(built.chips[0].value).toBe("2.0, needs 3.3 to break even");
    expect(built.chips[1].value).toBe("₹1,200");
    const mixed = [losing(5), dayResult(6, { cells: [cell({ spend: 100, contribution: 600 })] }), losing(7)];
    expect(askDef("roas_below_breakeven")!.precondition(input(fuel, stateAt(fuel, 7), { history: mixed }))).toBe(false);
  });
});

describe("pickCheckIns", () => {
  it("picks one ask, skips ones already asked, and stops after 3", () => {
    const shared = [campaign({ geography: "select_cities", cities: ["Karnataka"], keywords: [{ term: "protein powder", exactBid: 400 }] })];
    const inp = input(fuel, withOsa(fuel, 42, 13), { campaigns: shared });
    expect(eligibleAsks(inp)).toEqual(["restock", "match_discount"]);
    expect(pickCheckIns(inp, [])?.id).toBe("restock");
    expect(pickCheckIns(inp, ["restock"])?.id).toBe("match_discount");
    expect(pickCheckIns(inp, ["restock", "match_discount"])).toBeNull();
    expect(pickCheckIns(inp, ["sov_threat", "cofund_banner", "new_dark_stores"])).toBeNull();
    expect(isCheckInDay(6, [])).toBe(true);
    expect(isCheckInDay(7, [])).toBe(false);
    expect(isCheckInDay(13, ["restock", "sov_threat", "cofund_banner"])).toBe(false);
  });

  it("never offers an ask whose precondition is false, over many generated states", () => {
    const rand = mulberry32(7);
    const brands = ["fuelup", "henlo", "vitaboost"];
    const askIds = ROHIT_ASKS.map((a) => a.id);
    let checked = 0;
    const seen = new Set<AskId>();
    for (const brand of brands) {
      const ctx = testContext(brand);
      const kws = ctx.market.keywords.slice(0, 4).map((k) => ({ term: k.term, exactBid: 300 + Math.round(rand() * 400) }));
      const strategies: CampaignConfig[][] = [
        [{ ...campaign({ skuIds: ctx.scenario.profile.skus.map((s) => s.id), budget: 15000 }), keywords: kws }],
        [{ ...campaign({ skuIds: [ctx.scenario.profile.skus[0].id], geography: "select_cities", cities: [ctx.scenario.profile.primaryState, "Goa"], budget: 2500 }), keywords: kws.slice(0, 2) }],
      ];
      for (const camps of strategies) {
        let state = initialMarketState(ctx);
        const history: DayResult[] = [];
        for (let d = 1; d <= 24; d++) {
          const out = stepDay(ctx, state, camps);
          state = out.state;
          history.push(out.result);
          if (d % 2) continue;
          const shaken: MarketState = rand() < 0.5 ? state : {
            ...state,
            stock: Object.fromEntries(Object.entries(state.stock).map(([sku, by]) => [sku, Object.fromEntries(Object.entries(by).map(([s, u]) => [s, u * rand() * 1.5]))])),
          };
          const tone = rand() < 0.2 ? "overstocked" as const : ctx.scenario.inventory.tone;
          const c2 = { ...ctx, scenario: { ...ctx.scenario, inventory: { ...ctx.scenario.inventory, tone } } };
          const inp: RohitInput = { ctx: c2, state: shaken, history, campaigns: camps, relationship: Math.round(rand() * 100) };
          const asked = askIds.filter(() => rand() < 0.3).slice(0, 2);
          const picked = pickCheckIns(inp, asked);
          const eligible = eligibleAsks(inp).filter((id) => !asked.includes(id));
          if (picked) {
            seen.add(picked.id);
            expect(askDef(picked.id)!.precondition(inp)).toBe(true);
            expect(asked).not.toContain(picked.id);
            expect(picked.id).toBe(eligible[0]);
          } else {
            expect(eligible).toEqual([]);
          }
          for (const def of ROHIT_ASKS.filter((a) => a.precondition(inp))) {
            const ask = def.build(inp);
            expect(ask.options.length).toBeGreaterThanOrEqual(2);
            expect(ask.options.length).toBeLessThanOrEqual(4);
            expect(ask.chips.length).toBeGreaterThan(0);
            const text = [ask.line, ...ask.chips.flatMap((c) => [c.label, c.value]), ...ask.options.flatMap((o) => [o.label, o.cost])].join(" ");
            expect(text).not.toContain("—");
            expect(text).not.toMatch(/NaN|undefined|Infinity/);
            ask.options.forEach((o) => expect(o.cost.length).toBeGreaterThan(0));
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(60);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  }, 120000);

  it("never exceeds 3 check-ins in a run", () => {
    expect(MAX_CHECKINS_PER_RUN).toBe(3);
  });
});

describe("commitments", () => {
  const base: Omit<Commitment, "kind" | "target"> = { id: "x", askId: "restock", text: "", fromDay: 5, dueDay: 7, keptDelta: 6, brokenDelta: -10 };

  it("stay pending until the due day has run", () => {
    const c: Commitment = { ...base, kind: "spend_at_least", target: 100 };
    expect(checkCommitments([c], stateAt(fuel, 6), [])[0].status).toBe("pending");
  });

  it("OSA promises are kept or broken by the due day's stock", () => {
    const c: Commitment = { ...base, kind: "osa_at_least", target: 0.5, state: "Karnataka", skuIds: ["fuel-1"] };
    const hist = (osa: number) => [dayResult(7, { stock: [stockRow({ osa })] })];
    expect(checkCommitments([c], stateAt(fuel, 7), hist(0.62))[0]).toMatchObject({ status: "kept", actual: 0.62 });
    expect(checkCommitments([c], stateAt(fuel, 7), hist(0.31))[0].status).toBe("broken");
  });

  it("spend promises count only matching terms inside the window", () => {
    const c: Commitment = { ...base, kind: "spend_at_least", target: 1000, terms: ["whey protein"] };
    const hist = [4, 5, 6, 7].map((d) => dayResult(d, { cells: [cell({ spend: 300 }), cell({ term: "protein bar", spend: 900 })] }));
    const [r] = checkCommitments([c], stateAt(fuel, 7), hist);
    expect(r.actual).toBe(900);
    expect(r.status).toBe("broken");
    expect(checkCommitments([{ ...c, target: 900 }], stateAt(fuel, 8), hist)[0].status).toBe("kept");
  });

  it("units and covers-ad-spend promises resolve from the run", () => {
    const units: Commitment = { ...base, kind: "units_at_least", target: 100, skuIds: ["fuel-1"] };
    const hist = [5, 6, 7].map((d) => dayResult(d, { stock: [stockRow({ adUnits: 20, organicUnits: 20 })], cells: [cell({ spend: 100, contribution: 150 })] }));
    expect(checkCommitments([units], stateAt(fuel, 7), hist)[0]).toMatchObject({ status: "kept", actual: 120 });
    const covers: Commitment = { ...base, kind: "covers_ad_spend", target: 0 };
    expect(checkCommitments([covers], stateAt(fuel, 7), hist)[0]).toMatchObject({ status: "kept", actual: 150 });
    const losing = hist.map((d) => ({ ...d, cells: [cell({ spend: 300, contribution: 100 })] }));
    expect(checkCommitments([covers], stateAt(fuel, 7), losing)[0].status).toBe("broken");
  });

  it("feed the relationship meter and come from replies", () => {
    const kept: Commitment = { ...base, kind: "covers_ad_spend", target: 0 };
    const results = checkCommitments([kept, { ...kept, id: "y", dueDay: 20 }], stateAt(fuel, 7), [dayResult(6, { cells: [cell()] })]);
    expect(relationshipChange(results)).toBe(6);
    const ask = askDef("restock")!.build(input(fuel, withOsa(fuel, 42), { campaigns: [campaign({ geography: "select_cities", cities: ["Karnataka"] })] }));
    const made = commitmentFor(ask, ask.options[0])!;
    expect(made).toMatchObject({ askId: "restock", kind: "osa_at_least", state: "Karnataka", dueDay: 12 });
    expect(commitmentFor(ask, ask.options[2])).toBeNull();
  });
});
