// ── Brief v2 derivations (SPEC §10, §14 F9) ───────────────────────────────────
// Pure functions behind the brand brief: unit economics, the worked break-even
// example, stakeholder targets, rival comparisons, state demand and keyword
// intelligence. The brief shows these; it never shows ROAS by state (§3.9 #18)
// or max profitable CPM per keyword (students work that out).

import type { BrandProfile, GoalType, Scenario, SKU, StateName, Velocity } from "@/data/scenarios";
import { BLINKIT_STATES } from "@/data/scenarios";
import type { BrandMarket, KeywordTier, RivalArchetype, RivalData } from "@/market/types";
import type { MarketContext } from "@/market/engineTypes";
import { stateShares } from "@/market/demand";
import { monthlyVolume, suggestKeywordRange, type BidRange } from "@/market/suggest";

/** Finance wants this much headroom over break-even. */
export const FINANCE_BUFFER = 1.1;
/** Brand head's SOV ask on head terms (0–1). */
export const BRAND_HEAD_SOV_TARGET = 0.3;
/** Ad spend used in the worked example. */
export const WORKED_EXAMPLE_SPEND = 1000;
/** Prices within this share of each other read as "about the same". */
const SAME_PRICE_BAND = 0.05;
/** Last month's SOV sits a little under what a rival aims for. */
const SOV_ACHIEVED_SHARE = 0.92;

// ── Unit economics ────────────────────────────────────────────────────────────

/** Break-even ROAS for one SKU: selling price ÷ contribution per unit (F9). */
export function breakEvenRoas(sku: Pick<SKU, "mrp" | "margin">): number {
  return sku.margin > 0 ? sku.mrp / sku.margin : Infinity;
}

export interface SkuEconomicsRow {
  id: string;
  name: string;
  mrp: number;
  margin: number;
  marginPct: number;
  breakEven: number;
  velocity: Velocity;
}

export function skuEconomics(profile: BrandProfile): SkuEconomicsRow[] {
  return profile.skus.map((s) => ({
    id: s.id,
    name: s.name,
    mrp: s.mrp,
    margin: s.margin,
    marginPct: s.mrp > 0 ? s.margin / s.mrp : 0,
    breakEven: breakEvenRoas(s),
    velocity: s.velocity,
  }));
}

export function breakEvenRange(profile: BrandProfile): { min: number; max: number } {
  const values = profile.skus.map(breakEvenRoas);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Break-even for an equal unit mix of all SKUs: Σ price ÷ Σ contribution. */
export function blendedBreakEven(profile: BrandProfile): number {
  const revenue = profile.skus.reduce((s, k) => s + k.mrp, 0);
  const contribution = profile.skus.reduce((s, k) => s + k.margin, 0);
  return contribution > 0 ? revenue / contribution : Infinity;
}

export interface WorkedExample {
  skuName: string;
  mrp: number;
  margin: number;
  adSpend: number;
  unitsToBreakEven: number;
  revenueToBreakEven: number;
  breakEven: number;
}

/** "Spend ₹1,000 on ads: how many units, and how much revenue, just to get it back?" */
export function workedExample(profile: BrandProfile): WorkedExample {
  const sku = profile.skus[0];
  const units = sku.margin > 0 ? WORKED_EXAMPLE_SPEND / sku.margin : Infinity;
  return {
    skuName: sku.name,
    mrp: sku.mrp,
    margin: sku.margin,
    adSpend: WORKED_EXAMPLE_SPEND,
    unitsToBreakEven: units,
    revenueToBreakEven: units * sku.mrp,
    breakEven: breakEvenRoas(sku),
  };
}

// ── Stakeholders ──────────────────────────────────────────────────────────────

export interface StakeholderTargets {
  blendedBreakEven: number;
  financeRoas: number;
  brandHeadSovPct: number;
}

export function stakeholderTargets(profile: BrandProfile): StakeholderTargets {
  const blended = blendedBreakEven(profile);
  return {
    blendedBreakEven: blended,
    financeRoas: Math.round(blended * FINANCE_BUFFER * 10) / 10,
    brandHeadSovPct: Math.round(BRAND_HEAD_SOV_TARGET * 100),
  };
}

export interface StakeholderAsk {
  who: string;
  ask: string;
  why: string;
}

export interface StakeholderView {
  finance: StakeholderAsk;
  brandHead: StakeholderAsk;
  /** Where the two pull apart for this kind of brand. */
  tension: string;
}

const TENSION_BY_GOAL: Record<GoalType, string> = {
  "ROAS-First":
    "Your client goal sides with finance, but the brand head will judge you on head terms. Those are where the market leader bids hardest, so holding 30% there can push ROAS under break-even. Decide which head terms are worth defending and which to let go.",
  "Awareness-First":
    "Your client goal sides with the brand head. Reach formats rarely hit finance's ROAS on their own, so agree up front which campaigns are judged on reach and which on return, or you'll be judged on both and miss both.",
  "Category-Creation":
    "Nobody searches this category much yet, so head-term SOV is cheap to win but converts slowly. Finance will see low ROAS in week one. Show them the path: awareness first, then the search volume you created.",
  "Volume-First":
    "Units matter most to the client, and volume comes from head terms. Finance will accept a thinner return for volume, but not a loss. Push units where ROAS stays above break-even and stop where it doesn't.",
  "Inventory-Clearance":
    "Clearing aging stock matters more than a perfect return, so finance's target is softer this month. The brand head still wants visibility on head terms. Spend where it moves units, not where it only buys SOV.",
};

export function stakeholderView(goalType: GoalType, t: StakeholderTargets): StakeholderView {
  return {
    finance: {
      who: "Finance controller",
      ask: `Blended ROAS of at least ${t.financeRoas.toFixed(1)}x for the month.`,
      why: `Break-even across your SKUs is about ${t.blendedBreakEven.toFixed(1)}x. Finance wants a 10% cushion on top, because returns, discounts and attribution gaps eat into it.`,
    },
    brandHead: {
      who: "Brand head",
      ask: `At least ${t.brandHeadSovPct}% share of voice on head terms.`,
      why: "Shoppers who don't see the brand on the big searches don't learn it exists. The brand head reports SOV to the founders every week.",
    },
    tension: TENSION_BY_GOAL[goalType],
  };
}

// ── Rivals ────────────────────────────────────────────────────────────────────

const ARCHETYPE_LABEL: Record<RivalArchetype, string> = {
  leader: "Market leader",
  challenger: "Challenger",
  price_warrior: "Price warrior",
  newcomer: "Newcomer",
};

export function archetypeLabel(a: RivalArchetype): string {
  return ARCHETYPE_LABEL[a];
}

/** Illustrative last-month SOV (%) from the rival's target; 0 if it wasn't in the market yet. */
export function lastMonthSov(rival: Pick<RivalData, "targetSov" | "activeFromDay">): number {
  if ((rival.activeFromDay ?? 1) > 1) return 0;
  return Math.round(rival.targetSov * 100 * SOV_ACHIEVED_SHARE);
}

export interface PriceComparison {
  skuName: string;
  skuPrice: number;
  diffPct: number;
  label: string;
}

/** Compare a rival's price with the student's SKU closest in price. */
export function comparePrice(rivalPrice: number, skus: readonly { name: string; mrp: number }[]): PriceComparison {
  const nearest = skus.reduce((best, s) => (Math.abs(s.mrp - rivalPrice) < Math.abs(best.mrp - rivalPrice) ? s : best));
  const diffPct = (rivalPrice - nearest.mrp) / nearest.mrp;
  const pct = Math.round(Math.abs(diffPct) * 100);
  const label = Math.abs(diffPct) <= SAME_PRICE_BAND ? "About the same" : diffPct < 0 ? `${pct}% cheaper` : `${pct}% pricier`;
  return { skuName: nearest.name, skuPrice: nearest.mrp, diffPct, label };
}

export interface BriefRival {
  id: string;
  name: string;
  archetype: RivalArchetype;
  archetypeLabel: string;
  price: number;
  priceVsYou: PriceComparison;
  lastMonthSovPct: number;
  /** Keywords it bid on last month, most expensive first (names only, never bids). */
  keyTerms: string[];
}

const KEY_TERM_COUNT = 3;

/**
 * Rivals shown in the brief, biggest last-month SOV first. Rivals that only
 * launch mid-run are left out: their launch is a seeded surprise (decision Q4).
 */
export function briefRivals(profile: BrandProfile, market: BrandMarket): BriefRival[] {
  return market.rivals
    .filter((r) => (r.activeFromDay ?? 1) <= 1)
    .map((r) => ({
      id: r.id,
      name: r.name,
      archetype: r.archetype,
      archetypeLabel: archetypeLabel(r.archetype),
      price: r.price,
      priceVsYou: comparePrice(r.price, profile.skus),
      lastMonthSovPct: lastMonthSov(r),
      keyTerms: Object.entries(r.bids).sort(([, a], [, b]) => b - a).slice(0, KEY_TERM_COUNT).map(([term]) => term),
    }))
    .sort((a, b) => b.lastMonthSovPct - a.lastMonthSovPct);
}

// ── States ────────────────────────────────────────────────────────────────────

export interface StateDemandRow {
  state: StateName;
  /** Share of national searches for this brand's category (0–1). */
  demandShare: number;
  /** On-shelf availability % from the scenario. */
  osa: number;
}

/** Stocked states with last month's demand share and today's OSA. Demand and stock only. */
export function stateDemandRows(scenario: Pick<Scenario, "cityStockMap">, market: BrandMarket): StateDemandRow[] {
  const shares = stateShares(market);
  return BLINKIT_STATES
    .filter((s) => (scenario.cityStockMap[s] ?? 0) > 0)
    .map((s) => ({ state: s, demandShare: shares[s] ?? 0, osa: scenario.cityStockMap[s] }))
    .sort((a, b) => b.demandShare - a.demandShare);
}

// ── Keywords ──────────────────────────────────────────────────────────────────

export interface KeywordRow {
  term: string;
  tier: KeywordTier;
  monthlySearches: number;
  /** Last month's typical CPM to win the top slot (₹). */
  cpmRange: BidRange;
  isBrandTerm: boolean;
  /** Whether the brief's v1 lists flagged it. */
  v1: "good" | "risky" | null;
}

const TIER_ORDER: Record<KeywordTier, number> = { head: 0, mid: 1, long: 2 };

export function keywordRows(ctx: MarketContext): KeywordRow[] {
  const { goodKeywords, riskyKeywords } = ctx.scenario.profile;
  const good = new Set(goodKeywords.map((k) => k.toLowerCase()));
  const risky = new Set(riskyKeywords.map((k) => k.toLowerCase()));
  return ctx.market.keywords
    .map((k) => ({
      term: k.term,
      tier: k.tier,
      monthlySearches: monthlyVolume(ctx, k.term),
      cpmRange: suggestKeywordRange(ctx, k.term),
      isBrandTerm: k.isBrandTerm === true,
      v1: good.has(k.term) ? "good" as const : risky.has(k.term) ? "risky" as const : null,
    }))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.monthlySearches - a.monthlySearches);
}

/** v1 shortlist keywords that aren't in the market data (shown as plain chips). */
export function unlistedV1Keywords(profile: BrandProfile, market: BrandMarket): { good: string[]; risky: string[] } {
  const known = new Set(market.keywords.map((k) => k.term));
  return {
    good: profile.goodKeywords.filter((k) => !known.has(k.toLowerCase())),
    risky: profile.riskyKeywords.filter((k) => !known.has(k.toLowerCase())),
  };
}
