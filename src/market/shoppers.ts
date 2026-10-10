// ── Shopper response (SPEC §3.5, §14 F4, F7, F10) ─────────────────────────────
// Expected values, not random draws: the noise comes from demand (Poisson
// searches), so outcomes stay smooth and every number can be explained.

/** Share of add-to-carts that complete checkout. */
export const CHECKOUT_RATE = 0.85;

/** Indirect (halo) revenue: other SKUs of the brand bought after the ad click,
 *  as a share of direct revenue. ROAS counts direct + indirect (decision #20). */
export const INDIRECT_REVENUE_RATE = 0.15;

const BRAND_TERM_AFFINITY = 1.5;
const MAX_REACH_AFFINITY_LIFT = 0.15;

const PRICE_GAP_START = 0.05;
const PRICE_GAP_SPAN = 0.2;
const MAX_PRICE_PENALTY = 0.3;

const FATIGUE_FREE_FREQUENCY = 3;
const FATIGUE_RATE = 0.04;

export interface ShopperInputs {
  viewableImpressions: number;
  baseCTR: number;
  creativeMult: number;
  affinity: number;
  fatigueMult: number;
  baseCVR: number;
  /** Fit of the SKU being shown for this keyword. */
  fit: number;
  /** Slot intent multiplier. */
  intent: number;
  stateCVR: number;
  priceEffect: number;
  sellingPrice: number;
  contributionPerUnit: number;
}

export interface ShopperOutcome {
  clicks: number;
  atcs: number;
  units: number;
  directRevenue: number;
  indirectRevenue: number;
  /** direct + indirect */
  revenue: number;
  /** Contribution on direct and indirect sales, before ad spend. */
  contribution: number;
}

export function shopperOutcome(i: ShopperInputs): ShopperOutcome {
  const clicks = i.viewableImpressions * i.baseCTR * i.creativeMult * i.affinity * i.fatigueMult;
  const atcs = clicks * i.baseCVR * i.fit * i.intent * i.stateCVR * i.priceEffect;
  const units = atcs * CHECKOUT_RATE;
  const directRevenue = units * i.sellingPrice;
  const indirectRevenue = directRevenue * INDIRECT_REVENUE_RATE;
  return {
    clicks,
    atcs,
    units,
    directRevenue,
    indirectRevenue,
    revenue: directRevenue + indirectRevenue,
    contribution: units * i.contributionPerUnit * (1 + INDIRECT_REVENUE_RATE),
  };
}

/** CVR penalty when a cheaper rival ad is on the same page (null = none). */
export function priceEffect(yourPrice: number, cheapestRivalOnPage: number | null): number {
  if (cheapestRivalOnPage === null || yourPrice <= 0) return 1;
  const gap = (yourPrice - cheapestRivalOnPage) / yourPrice;
  const severity = Math.min(1, Math.max(0, (gap - PRICE_GAP_START) / PRICE_GAP_SPAN));
  return 1 - MAX_PRICE_PENALTY * severity;
}

/** Shopper affinity: high on the brand's own name, else grows with reach (reach ÷ shoppers). */
export function affinity(isBrandTerm: boolean, reachShare: number): number {
  if (isBrandTerm) return BRAND_TERM_AFFINITY;
  return 1 + MAX_REACH_AFFINITY_LIFT * Math.min(1, Math.max(0, reachShare));
}

/** Creative fatigue by frequency (viewable impressions ÷ unique shoppers reached). */
export function fatigueMult(frequency: number): number {
  return 1 / (1 + FATIGUE_RATE * Math.max(0, frequency - FATIGUE_FREE_FREQUENCY));
}

/** Highest CPM at which these impressions break even (F4): contribution per 1,000 viewable impressions. */
export function maxProfitableCPM(inputs: Omit<ShopperInputs, "viewableImpressions">): number {
  return shopperOutcome({ ...inputs, viewableImpressions: 1000 }).contribution;
}
