/**
 * engine.ts — Unified day-level simulation engine
 *
 * Single source of truth for ALL metric calculations.
 * Used by: LiveDashboard (per-day tick), Results page (aggregation), scoring.
 *
 * Formula chain (all derived from same spend — ROAS can never inflate):
 *   actualSpend = dailyBudget × geoQuality × crisisMult
 *   impressions = (actualSpend / effectiveCPM) × 1000 × cmBonus
 *   ctr         = 0.008 × kwQuality × formatMatch × objectiveMatch × daypartMult
 *   clicks      = impressions × ctr
 *   atcs        = clicks × 0.25
 *   units       = min(atcs × 0.6, stockAvailable)
 *   revenue     = units × avgMRP
 *   roas        = revenue / actualSpend
 *
 * Stock:
 *   Depletes daily by units sold.
 *   Replenishes weekly: Healthy 30%, Warning 15%, Critical 0%, Overstocked 0%.
 *
 * Simulation ends when totalSpent ≥ ₹2,00,000 OR day > 120.
 */

import type { Scenario, CityName } from "@/data/scenarios";
import type { SavedCampaign, CmPitchResult, StockMap } from "@/context/SimContext";

// ─── Simulation constants ─────────────────────────────────────────────────────

export const TOTAL_SCENARIO_BUDGET = 200_000;   // ₹2,00,000
export const MAX_SIMULATION_DAYS   = 120;
export const WARNING_DAY_AMBER     = 100;
export const WARNING_DAY_ORANGE    = 110;

/** Crisis trigger thresholds (% of ₹2L spent) */
export const CRISIS_TRIGGERS = {
  1: 0.25,   // ₹50K
  2: 0.55,   // ₹1.1L
  3: 0.80,   // ₹1.6L
} as const;

// ─── CPM table (quick commerce rates, ₹) ─────────────────────────────────────

const BASE_CPM: Record<string, number> = {
  product_booster:    250,
  listing_spotlight:  200,
  brand_booster:      220,
  recommendation_ads: 230,
  stories:            280,
};

const COMPETITOR_CPM_MULT: Record<string, number> = {
  "Aggressive Competitor":  1.40,
  "Category Leader Entry":  1.15,
  "Price War in Category":  1.25,
};

const SEASON_CPM_MULT: Record<string, number> = {
  "Festival Surge":         1.30,
  "Pre-Festival Build":     1.15,
  "Post-Festival Slowdown": 0.85,
  "New Year Push":          1.10,
};

const CM_BONUS: Record<string, number> = {
  strong:   1.15,
  decent:   1.05,
  weak:     0.95,
  rejected: 0.85,
};

/** Dead hour block indices (12–3 AM = 6, 3–6 AM = 7) */
export const DEAD_BLOCKS = [6, 7] as const;

/** Hour block labels (index 0-7, each 3 hours) */
export const HOUR_BLOCK_LABELS = [
  "6–9 AM", "9 AM–12 PM", "12–3 PM", "3–6 PM",
  "6–9 PM", "9 PM–12 AM", "12–3 AM", "3–6 AM",
] as const;

/** Weekly replenishment rate by inventory tone */
const REPLENISH_RATE: Record<string, number> = {
  healthy:     0.30,
  warning:     0.15,
  critical:    0.00,
  overstocked: 0.00,
};

/** Starting units per SKU velocity */
const STARTING_UNITS: Record<string, number> = {
  High: 1000, Medium: 600, Low: 300, "Very Low": 150,
};

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * An active effect injected into the engine after a student resolves a crisis.
 * Effects multiply the corresponding engine parameters.
 */
export interface ActiveCrisisEffect {
  crisisNum: 1 | 2 | 3;
  /** Multiplies geoQuality (e.g. 0.5 = stock crisis halves effective geo) */
  geoQualityMult: number;
  /** Multiplies effectiveCPM (e.g. 1.3 = competitor attack raises CPMs) */
  cpmMult: number;
  /** Multiplies CTR (e.g. 1.1 = good crisis response boosts relevance) */
  ctrMult: number;
  /** Additional units drained from stock each day */
  stockDrainPerDay: number;
}

export interface CampaignDayMetric {
  campaignId: string;
  name: string;
  active: boolean;
  exhausted: boolean;       // overall-budget campaign hit its ceiling
  actualSpend: number;      // ₹ actually charged
  impressions: number;
  clicks: number;
  ctr: number;              // % e.g. 1.5 means 1.5%
  atcs: number;
  units: number;
  revenue: number;
  roas: number;
  geoQuality: number;       // 0–1, shown to student so they understand under-delivery
}

export interface DayResult {
  day: number;
  perCampaign: CampaignDayMetric[];
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalAtcs: number;
  totalUnits: number;
  totalRevenue: number;
  cumulativeSpend: number;
  stockAfter: StockMap;
  simulationEnded: boolean;
  warningLevel: "none" | "amber" | "orange" | "ended";
}

export interface DayInput {
  day: number;
  scenario: Scenario;
  campaigns: SavedCampaign[];
  cmPitch: CmPitchResult | null;
  stockLevels: StockMap;
  /** Total ₹ spent across ALL days so far (before this day) */
  cumulativeSpend: number;
  /** Per-campaign cumulative spend — used to check overall-budget exhaustion */
  campaignCumulativeSpend: Record<string, number>;
  /** campaignId → active hour-block indices (0–7). Missing/empty = 24/7 */
  customDayparts: Record<string, number[]>;
  /** Active crisis effects from student's resolved crises */
  crisisEffects: ActiveCrisisEffect[];
}

export interface RunTotals {
  days: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalAtcs: number;
  totalUnits: number;
  totalRevenue: number;
  ctr: number;
  roas: number;
  cvr: number;
  reach: number;
  brandedLift: number;
  sellThrough: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function getBaseCPM(adFormat: string | null): number {
  return BASE_CPM[adFormat ?? ""] ?? 250;
}

function getCompetitorMult(marketName: string): number {
  return COMPETITOR_CPM_MULT[marketName] ?? 1.0;
}

function getSeasonMult(seasonName: string): number {
  return SEASON_CPM_MULT[seasonName] ?? 1.0;
}

function getCmBonus(status: string | undefined): number {
  return CM_BONUS[status ?? ""] ?? 1.0;
}

/** Peak hour-block indices for a brand's category */
export function getPeakBlocks(category: string): number[] {
  const c = category.toLowerCase();
  if (c.includes("baby"))                                         return [1];       // 9 AM–12 PM
  if (c.includes("snack"))                                        return [3, 4];    // 3–6 PM, 6–9 PM
  if (c.includes("pet"))                                          return [0, 4];    // 6–9 AM, 6–9 PM
  if (c.includes("supplement") || c.includes("protein") || c.includes("fitness")) return [0, 4];
  if (c.includes("skincare"))                                     return [1, 4];    // 9 AM–12 PM, 6–9 PM
  return [0, 1, 4];
}

/**
 * Daypart multiplier for CTR based on Option B custom hour-block selection.
 *
 * Rewards:  removing dead hours (12–6 AM) AND keeping all peak blocks.
 * Penalises: removing peak blocks.
 *
 * Range: [0.5, 1.2]. Default (24/7) = 1.0.
 */
export function computeDaypartMult(
  activeBlocks: number[] | undefined,
  peakBlocks: number[],
): number {
  if (!activeBlocks || activeBlocks.length === 0) return 1.0;

  let mult = 1.0;

  // +0.05 per dead block removed (max +0.10)
  const deadRemoved = DEAD_BLOCKS.filter(b => !activeBlocks.includes(b)).length;
  mult += deadRemoved * 0.05;

  // +0.10 if all peak blocks retained AND at least one dead block removed
  const allPeaksKept = peakBlocks.every(b => activeBlocks.includes(b));
  if (allPeaksKept && deadRemoved > 0) mult += 0.10;

  // −0.15 per peak block removed (big penalty)
  const peaksRemoved = peakBlocks.filter(b => !activeBlocks.includes(b)).length;
  mult -= peaksRemoved * 0.15;

  return Math.max(0.5, Math.min(1.2, mult));
}

/**
 * Keyword quality multiplier for CTR.
 *   All good, zero risky → 1.5
 *   Majority good        → 1.0
 *   Equal split          → 0.7
 *   Majority risky       → 0.5
 *   No keywords          → 1.0 (neutral)
 */
export function computeKwQuality(keywords: string[], goodKeywords: string[]): number {
  if (keywords.length === 0) return 1.0;
  const goodHits = keywords.filter(k => goodKeywords.includes(k)).length;
  const riskyHits = keywords.length - goodHits;
  if (riskyHits === 0)        return 1.5;
  if (goodHits > riskyHits)   return 1.0;
  if (goodHits === riskyHits) return 0.7;
  return 0.5;
}

function computeFormatMatch(adFormat: string | null, optimalAdFormat: string): number {
  return adFormat === optimalAdFormat ? 1.3 : 0.8;
}

function computeObjectiveMatch(objective: string | null, optimalObjective: string): number {
  return objective === optimalObjective ? 1.2 : 0.8;
}

/**
 * Geo quality = (stockedCities / selectedCities) × avgOSA of stocked cities.
 * Drives what fraction of the daily budget is actually deliverable.
 */
export function computeGeoQuality(
  campaign: SavedCampaign,
  osaMap: Record<string, number>,
): { geoQuality: number; stockedCities: string[]; avgOsa: number } {
  const selected = campaign.cities.length > 0
    ? campaign.cities
    : (Object.keys(osaMap) as string[]);

  const stockedCities = selected.filter(c => (osaMap[c] ?? 0) > 0);

  if (stockedCities.length === 0) {
    return { geoQuality: 0, stockedCities: [], avgOsa: 0 };
  }

  const avgOsa =
    stockedCities.reduce((s, c) => s + (osaMap[c] ?? 0), 0) / stockedCities.length / 100;

  const geoQuality = (stockedCities.length / selected.length) * avgOsa;

  return { geoQuality, stockedCities, avgOsa };
}

function combineCrisisEffects(effects: ActiveCrisisEffect[]): {
  geoQualityMult: number;
  cpmMult: number;
  ctrMult: number;
  stockDrainPerDay: number;
} {
  return effects.reduce(
    (acc, e) => ({
      geoQualityMult: acc.geoQualityMult * e.geoQualityMult,
      cpmMult:        acc.cpmMult        * e.cpmMult,
      ctrMult:        acc.ctrMult        * e.ctrMult,
      stockDrainPerDay: acc.stockDrainPerDay + e.stockDrainPerDay,
    }),
    { geoQualityMult: 1.0, cpmMult: 1.0, ctrMult: 1.0, stockDrainPerDay: 0 },
  );
}

// ─── Stock helpers ────────────────────────────────────────────────────────────

/** Initial stock per SKU per state, built from scenario.cityStockMap */
export function buildInitialStock(scenario: Scenario): StockMap {
  const map: StockMap = {};
  for (const sku of scenario.profile.skus) {
    map[sku.id] = {};
    for (const state of Object.keys(scenario.cityStockMap) as CityName[]) {
      const osa  = scenario.cityStockMap[state] ?? 0;
      const base = STARTING_UNITS[sku.velocity] ?? 300;
      map[sku.id][state] = Math.round(base * (osa / 100));
    }
  }
  return map;
}

/**
 * Weekly stock replenishment — call once every 7 days.
 * Refills a % of depleted stock, capped at the original ceiling.
 * Rate: Healthy 30%, Warning 15%, Critical 0%, Overstocked 0%.
 */
export function replenishStock(stock: StockMap, scenario: Scenario): StockMap {
  const rate = REPLENISH_RATE[scenario.inventory.tone] ?? 0;
  if (rate === 0) return stock;

  const replenished: StockMap = JSON.parse(JSON.stringify(stock));

  for (const sku of scenario.profile.skus) {
    for (const state of Object.keys(scenario.cityStockMap) as CityName[]) {
      const osa = scenario.cityStockMap[state] ?? 0;
      if (osa === 0) continue;

      const base    = STARTING_UNITS[sku.velocity] ?? 300;
      const ceiling = Math.round(base * (osa / 100));
      const current = replenished[sku.id]?.[state] ?? 0;
      const depleted = Math.max(0, ceiling - current);
      const refill   = Math.floor(depleted * rate);

      if (replenished[sku.id]) {
        replenished[sku.id][state] = Math.min(ceiling, current + refill);
      }
    }
  }

  return replenished;
}

/**
 * Convert live unit counts → OSA% per state.
 * States that never had stock (cityStockMap OSA = 0) stay at 0.
 */
export function buildLiveOsaMap(stock: StockMap, scenario: Scenario): Record<string, number> {
  const osaMap: Record<string, number> = {};

  for (const state of Object.keys(scenario.cityStockMap) as CityName[]) {
    const initialOsa = scenario.cityStockMap[state] ?? 0;
    if (initialOsa === 0) { osaMap[state] = 0; continue; }

    const pcts: number[] = [];
    for (const sku of scenario.profile.skus) {
      const base    = STARTING_UNITS[sku.velocity] ?? 300;
      const ceiling = Math.round(base * (initialOsa / 100));
      const units   = stock[sku.id]?.[state] ?? 0;
      pcts.push(ceiling > 0 ? (units / ceiling) * 100 : 0);
    }

    osaMap[state] = pcts.length
      ? pcts.reduce((a, b) => a + b, 0) / pcts.length
      : 0;
  }

  return osaMap;
}

// ─── Core: single day computation ────────────────────────────────────────────

/**
 * Compute one simulation day. Pure function — same inputs → same outputs.
 * LiveDashboard calls this once per day-tick.
 */
export function computeDay(input: DayInput): DayResult {
  const {
    day, scenario, campaigns, cmPitch, stockLevels,
    cumulativeSpend, campaignCumulativeSpend, customDayparts, crisisEffects,
  } = input;

  // Early exit: already over budget or day limit
  if (cumulativeSpend >= TOTAL_SCENARIO_BUDGET || day > MAX_SIMULATION_DAYS) {
    return {
      day, perCampaign: [], totalSpend: 0, totalImpressions: 0,
      totalClicks: 0, totalAtcs: 0, totalUnits: 0, totalRevenue: 0,
      cumulativeSpend,
      stockAfter: stockLevels,
      simulationEnded: true,
      warningLevel: "ended",
    };
  }

  // Scenario-level constants for this day
  const competitorMult = getCompetitorMult(scenario.market.name);
  const seasonMult     = getSeasonMult(scenario.season.name);
  const cmBonus        = getCmBonus(cmPitch?.status);
  const peakBlocks     = getPeakBlocks(scenario.profile.category);
  const crisis         = combineCrisisEffects(crisisEffects);

  // Build live OSA map from current stock (depletes as campaign sells)
  const liveOsaMap = buildLiveOsaMap(stockLevels, scenario);

  // Apply CM pitch OSA boost to approved cities
  const effectiveOsaMap: Record<string, number> = { ...liveOsaMap };
  if (cmPitch?.osaBoost && cmPitch.approvedCities.length > 0) {
    for (const city of cmPitch.approvedCities) {
      if ((effectiveOsaMap[city] ?? 0) > 0) {
        effectiveOsaMap[city] = Math.min(100, effectiveOsaMap[city] * 1.1);
      }
    }
  }

  const newStock: StockMap = JSON.parse(JSON.stringify(stockLevels));
  let dayRunningSpend = 0; // tracks spend within this day across campaigns

  const perCampaign: CampaignDayMetric[] = campaigns.map(campaign => {
    const zero = (active: boolean, exhausted: boolean): CampaignDayMetric => ({
      campaignId: campaign.id, name: campaign.name, active, exhausted,
      actualSpend: 0, impressions: 0, clicks: 0, ctr: 0,
      atcs: 0, units: 0, revenue: 0, roas: 0, geoQuality: 0,
    });

    // Not launched yet
    const launchDay = campaign.launchDay ?? 1;
    if (day < launchDay) return zero(false, false);

    // Determine daily budget allowance
    const campaignSpentSoFar = campaignCumulativeSpend[campaign.id] ?? 0;
    let dailyAllowance: number;
    let exhausted = false;

    if (campaign.budgetType === "overall") {
      const endDay = (campaign as SavedCampaign & { endDay?: number }).endDay
        ?? (launchDay + 29);
      const remainingBudget = campaign.budget - campaignSpentSoFar;
      if (remainingBudget <= 0) { exhausted = true; return zero(false, true); }
      const daysLeft = Math.max(1, endDay - day + 1);
      dailyAllowance = remainingBudget / daysLeft;
    } else {
      // daily budget: fixed daily cap
      dailyAllowance = campaign.budget;
    }

    // ── Geo quality ────────────────────────────────────────────────────────
    const { geoQuality, stockedCities } = computeGeoQuality(campaign, effectiveOsaMap);
    const effectiveGeoQuality = geoQuality * crisis.geoQualityMult;

    if (stockedCities.length === 0 || effectiveGeoQuality <= 0) {
      return { ...zero(true, exhausted), geoQuality };
    }

    // ── Actual spend ───────────────────────────────────────────────────────
    // Capped by: geoQuality, remaining scenario budget, and daily allowance
    const scenarioBudgetLeft = TOTAL_SCENARIO_BUDGET - cumulativeSpend - dayRunningSpend;
    const rawSpend = dailyAllowance * effectiveGeoQuality;
    const actualSpend = Math.min(rawSpend, scenarioBudgetLeft, dailyAllowance);

    if (actualSpend <= 0) return { ...zero(true, exhausted), geoQuality };

    // ── Impressions (spend ÷ CPM) ─────────────────────────────────────────
    const baseCPM       = getBaseCPM(campaign.adFormat);
    const effectiveCPM  = baseCPM * competitorMult * seasonMult * crisis.cpmMult;
    const impressions   = Math.round((actualSpend / effectiveCPM) * 1000 * cmBonus);

    // ── CTR → Clicks ──────────────────────────────────────────────────────
    const kwQuality     = computeKwQuality(campaign.keywords, scenario.profile.goodKeywords);
    const formatMatch   = computeFormatMatch(campaign.adFormat, scenario.profile.optimalAdFormat);
    const objectiveMatch = computeObjectiveMatch(campaign.objective, scenario.profile.optimalObjective);
    const daypartMult   = computeDaypartMult(customDayparts[campaign.id], peakBlocks);

    const ctrRate = 0.008 * kwQuality * formatMatch * objectiveMatch * daypartMult * crisis.ctrMult;
    const clicks  = Math.round(impressions * ctrRate);

    // ── Conversions gated by live stock ───────────────────────────────────
    const atcs        = Math.round(clicks * 0.25);
    const wantedUnits = Math.round(atcs * 0.6);

    const validSkus = campaign.skuIds.length > 0
      ? campaign.skuIds
      : scenario.profile.skus.map(s => s.id);
    const unitsPerSku = wantedUnits / Math.max(1, validSkus.length);

    let actualUnits = 0;
    for (const skuId of validSkus) {
      const unitsPerCity = unitsPerSku / Math.max(1, stockedCities.length);
      for (const city of stockedCities) {
        const available = newStock[skuId]?.[city] ?? 0;
        const sold = Math.min(unitsPerCity, available);
        if (newStock[skuId] !== undefined) {
          newStock[skuId][city] = Math.max(0, available - sold);
        }
        actualUnits += sold;
      }
    }
    actualUnits = Math.round(actualUnits);

    // ── Revenue & ROAS ────────────────────────────────────────────────────
    const avgMrp = validSkus.length > 0
      ? validSkus
          .map(id => scenario.profile.skus.find(s => s.id === id)?.mrp ?? 0)
          .reduce((a, b) => a + b, 0) / validSkus.length
      : 0;
    const revenue = Math.round(actualUnits * avgMrp);
    const roas    = actualSpend > 0 ? revenue / actualSpend : 0;

    dayRunningSpend += actualSpend;

    return {
      campaignId:  campaign.id,
      name:        campaign.name,
      active:      true,
      exhausted:   false,
      actualSpend: Math.round(actualSpend),
      impressions,
      clicks,
      ctr:         +(ctrRate * 100).toFixed(2),
      atcs,
      units:       actualUnits,
      revenue,
      roas:        +roas.toFixed(2),
      geoQuality:  +geoQuality.toFixed(3),
    };
  });

  // Apply crisis stock drain (e.g. supply disruption burns stock passively)
  if (crisis.stockDrainPerDay > 0) {
    for (const sku of scenario.profile.skus) {
      for (const state of Object.keys(newStock[sku.id] ?? {})) {
        const current = newStock[sku.id]?.[state] ?? 0;
        if (current > 0 && newStock[sku.id]) {
          newStock[sku.id][state] = Math.max(0, current - crisis.stockDrainPerDay);
        }
      }
    }
  }

  // Day totals
  const totalSpend       = Math.round(perCampaign.reduce((s, m) => s + m.actualSpend, 0));
  const totalImpressions = perCampaign.reduce((s, m) => s + m.impressions, 0);
  const totalClicks      = perCampaign.reduce((s, m) => s + m.clicks, 0);
  const totalAtcs        = perCampaign.reduce((s, m) => s + m.atcs, 0);
  const totalUnits       = perCampaign.reduce((s, m) => s + m.units, 0);
  const totalRevenue     = perCampaign.reduce((s, m) => s + m.revenue, 0);
  const newCumulative    = cumulativeSpend + totalSpend;

  const simulationEnded  = newCumulative >= TOTAL_SCENARIO_BUDGET || day >= MAX_SIMULATION_DAYS;
  const warningLevel: DayResult["warningLevel"] =
    simulationEnded           ? "ended"  :
    day >= WARNING_DAY_ORANGE ? "orange" :
    day >= WARNING_DAY_AMBER  ? "amber"  : "none";

  return {
    day,
    perCampaign,
    totalSpend,
    totalImpressions,
    totalClicks,
    totalAtcs,
    totalUnits,
    totalRevenue,
    cumulativeSpend: newCumulative,
    stockAfter:      newStock,
    simulationEnded,
    warningLevel,
  };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregate an array of DayResults into run-level totals.
 * Used by the Results page for goal-achievement scoring.
 */
export function aggregateRunTotals(dayResults: DayResult[]): RunTotals {
  const totalSpend       = dayResults.reduce((s, d) => s + d.totalSpend, 0);
  const totalImpressions = dayResults.reduce((s, d) => s + d.totalImpressions, 0);
  const totalClicks      = dayResults.reduce((s, d) => s + d.totalClicks, 0);
  const totalAtcs        = dayResults.reduce((s, d) => s + d.totalAtcs, 0);
  const totalUnits       = dayResults.reduce((s, d) => s + d.totalUnits, 0);
  const totalRevenue     = dayResults.reduce((s, d) => s + d.totalRevenue, 0);

  return {
    days:            dayResults.length,
    totalSpend:      Math.round(totalSpend),
    totalImpressions: Math.round(totalImpressions),
    totalClicks:     Math.round(totalClicks),
    totalAtcs:       Math.round(totalAtcs),
    totalUnits:      Math.round(totalUnits),
    totalRevenue:    Math.round(totalRevenue),
    ctr:  totalImpressions > 0 ? +((totalClicks      / totalImpressions) * 100).toFixed(2) : 0,
    roas: totalSpend       > 0 ? +(totalRevenue       / totalSpend).toFixed(2)              : 0,
    cvr:  totalClicks      > 0 ? +((totalUnits        / totalClicks)      * 100).toFixed(2) : 0,
    reach:        Math.round(totalImpressions * 0.4),
    brandedLift:  Math.round(Math.min(50, totalImpressions / 200_000)),
    sellThrough:  Math.min(100, Math.round((totalUnits / 1500) * 100)),
  };
}

/**
 * Check whether a crisis should trigger based on cumulative spend.
 * Returns the crisis number (1/2/3) if it just crossed the threshold, or null.
 */
export function checkCrisisTrigger(
  prevSpend: number,
  newSpend: number,
  alreadyTriggered: Set<1 | 2 | 3>,
): 1 | 2 | 3 | null {
  for (const [numStr, pct] of Object.entries(CRISIS_TRIGGERS)) {
    const num = Number(numStr) as 1 | 2 | 3;
    if (alreadyTriggered.has(num)) continue;
    const threshold = TOTAL_SCENARIO_BUDGET * pct;
    if (prevSpend < threshold && newSpend >= threshold) return num;
  }
  return null;
}
