/**
 * dayEngine.ts — single-pass simulation engine
 *
 * Rules:
 *  - budgetType "daily"   → spend campaign.budget every active day
 *  - budgetType "overall" → spend campaign.budget / (endDay − launchDay + 1) per day, stop at endDay
 *  - Runs day 1..MAX_DAYS (120); stops early when cumulativeSpend >= scenario.budget
 *  - Stock is a binary gate: city active if ANY sku has stock > 0; no OSA scaling
 *  - BASE_CPM = ₹250 (real-world Blinkit rate)
 *  - Crisis modifiers: spendMult + revMult only (spendAdd ignored — ₹8k shown as display-only deduction)
 */

import type { Scenario, CityStockMap } from "@/data/scenarios";
import type { SavedCampaign, CampaignOptimization, StockMap, CmPitchResult } from "@/context/SimContext";
import type { DailyNoise } from "./noise";
import { modifierForDay } from "./crisisEvents";
import type { ModifierContext } from "./crisisEvents";

// ── Constants ─────────────────────────────────────────────────────────────────
export const MAX_DAYS  = 120;
export const BASE_CPM  = 250;   // ₹ per 1,000 impressions
const BASE_CTR         = 0.015; // 1.5% click-through rate
const BASE_CVR         = 0.18;  // 18% add-to-cart rate (real Blinkit range: 15–25%)
const ATC_TO_UNITS     = 0.85;  // 85% of ATCs become completed purchases

// Time-slot CPM multipliers (indices 0–7, matching 3-hour blocks from 12 AM)
// Slot 0: 12–3 AM, 1: 3–6 AM, 2: 6–9 AM, 3: 9–12 PM,
// 4: 12–3 PM,  5: 3–6 PM,  6: 6–9 PM (peak), 7: 9–12 AM
const TIME_SLOT_MULTS = [0.80, 0.80, 1.00, 1.10, 1.10, 1.20, 1.40, 1.15];
const ALL_SLOTS_AVG   = TIME_SLOT_MULTS.reduce((s, v) => s + v, 0) / TIME_SLOT_MULTS.length;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CampaignDayMetric {
  spend: number;
  impressions: number;
  clicks: number;
  atcs: number;
  units: number;
  revenue: number;
}

export interface EngineDayResult {
  day: number;
  spend: number;
  impressions: number;
  clicks: number;
  atcs: number;
  units: number;
  revenue: number;
  byCampaign: Record<string, CampaignDayMetric>;
}

export interface EngineInput {
  scenario: Scenario;
  campaigns: SavedCampaign[];
  cmPitch: CmPitchResult | null;
  optimizations: Record<string, CampaignOptimization>;
  stockLevels: StockMap;
  crisisDecisions: { num: 1 | 2 | 3; optionKey: string }[];
  dailyNoise: DailyNoise;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clamp a number between min and max */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Keyword quality multiplier — applies only to product_booster and recommendation_ads.
 * Compares the campaign's selected keywords against the brand's goodKeywords / riskyKeywords.
 *
 * Good keywords = high purchase intent → CTR and CVR boost (people searching these actually buy).
 * Risky keywords = brand/generic terms → clicks happen but CVR collapses (browsers, not buyers).
 * No keywords on a keyword-targeting format → generic low-intent traffic.
 *
 * Returns { ctrMult, cvrMult } to apply independently on each metric.
 */
function keywordQualityMult(
  c: SavedCampaign,
  profile: { goodKeywords: string[]; riskyKeywords: string[] },
): { ctrMult: number; cvrMult: number } {
  // Only keyword-targeting formats are affected
  const kwFormats = ["product_booster", "recommendation_ads"];
  if (!kwFormats.includes(c.adFormat ?? "")) return { ctrMult: 1.0, cvrMult: 1.0 };

  const kws = c.keywords ?? [];
  // No keywords selected → broad, unintentional targeting
  if (kws.length === 0) return { ctrMult: 0.5, cvrMult: 0.5 };

  const goodCount  = kws.filter((kw) => profile.goodKeywords.includes(kw)).length;
  const riskyCount = kws.filter((kw) => profile.riskyKeywords.includes(kw)).length;
  const goodRatio  = goodCount  / kws.length;
  const riskyRatio = riskyCount / kws.length;

  // Good keywords lift both CTR (intent) and CVR (purchase likelihood).
  // Risky keywords cause some clicks but poor conversion (expensive & broad).
  // CVR is penalised harder by risky keywords than CTR (clicks happen, buys don't).
  const ctrMult = clamp(0.5 + goodRatio * 0.7 - riskyRatio * 0.2, 0.30, 1.20);
  const cvrMult = clamp(0.5 + goodRatio * 0.7 - riskyRatio * 0.4, 0.10, 1.20);

  return { ctrMult, cvrMult };
}

/**
 * Geographic conversion multiplier — affects CVR only, not impressions or clicks.
 * Impressions are served regardless; but clicks from unstocked states don't convert
 * (customers see the ad, tap, but can't order because the store is dark / OOS).
 *
 * Pan India with limited state coverage dilutes conversions proportionally.
 * Select-cities targeting that exactly matches stocked states rewards precision.
 */
function geoConversionMult(
  c: SavedCampaign,
  cityStockMap: CityStockMap,
): number {
  const allStates    = Object.keys(cityStockMap);
  const stockedCount = allStates.filter((s) => (cityStockMap[s] ?? 0) > 0).length;
  const total        = allStates.length;
  if (total === 0) return 1.0;

  const panIndia = c.geography === "pan_india" || !c.cities || c.cities.length === 0;

  if (panIndia) {
    // Penalise proportionally to the fraction of unstocked states getting traffic
    return clamp(0.40 + 0.60 * (stockedCount / total), 0.40, 1.00);
  }

  // Select cities: compare chosen states against which ones actually have stock
  const stockRatio = c.cities.length > 0
    ? c.cities.filter((s) => (cityStockMap[s] ?? 0) > 0).length / c.cities.length
    : stockedCount / total;

  if (stockRatio >= 1) return 1.25; // All selected states have stock → precision rewarded
  if (stockRatio <= 0) return 0.10; // No selected state has stock → heavy penalty
  return clamp(0.30 + 0.95 * stockRatio, 0.30, 1.24);
}

/** Binary stock gate: returns true if campaign can deliver ads in at least one city */
function hasStock(c: SavedCampaign, stockLevels: StockMap): boolean {
  // If stock map is empty (not yet initialised), allow all campaigns to run
  if (Object.keys(stockLevels).length === 0) return true;
  // Keep only SKU IDs that actually exist in the stock map.
  // If none match (ID mismatch between campaign and scenario), fall back to all stock keys.
  const matched = c.skuIds.filter((id) => id in stockLevels);
  const skuIds  = matched.length > 0 ? matched : Object.keys(stockLevels);
  if (skuIds.length === 0) return true;
  // Pan India or no explicit city selection → check all cities in the SKU stock map
  const panIndia = c.geography === "pan_india" || c.cities.length === 0;
  for (const skuId of skuIds) {
    const skuStock = stockLevels[skuId];
    if (!skuStock) continue;
    if (panIndia) {
      if (Object.values(skuStock).some((qty) => qty > 0)) return true;
    } else {
      for (const city of c.cities) {
        if ((skuStock[city] ?? 0) > 0) return true;
      }
    }
  }
  return false;
}

/** Average MRP across all scenario SKUs */
function avgMrpFor(scenario: Scenario): number {
  const skus = scenario.profile.skus ?? [];
  if (skus.length === 0) return 100;
  return skus.reduce((s, sku) => s + sku.mrp, 0) / skus.length;
}

/**
 * Normalized daypart CPM multiplier.
 * 24/7 (all 8 slots) → 1.0.  Peak-only → >1.0 (fewer impressions per ₹).
 * Empty/undefined → 1.0 (treated as 24/7).
 */
function daypartCPMMult(activeSlots: number[]): number {
  if (!activeSlots || activeSlots.length === 0 || activeSlots.length === 8) return 1.0;
  const avg = activeSlots.reduce((s, i) => s + (TIME_SLOT_MULTS[i] ?? 1.0), 0) / activeSlots.length;
  return avg / ALL_SLOTS_AVG;
}

/**
 * Convert sim day d to a selectedDays weekday index (0=Sun..6=Sat).
 * Sim day 1 = Monday (matching noise.ts convention where days 6,7 are weekend).
 */
function simDayToWeekdayIdx(d: number): number {
  const simWeekday = (d - 1) % 7; // 0=Mon..6=Sun
  return simWeekday === 6 ? 0 : simWeekday + 1; // 0=Sun..6=Sat
}

// ── Main engine ───────────────────────────────────────────────────────────────
export function computeAllDays(input: EngineInput): EngineDayResult[] {
  const { scenario, campaigns, cmPitch, optimizations, stockLevels, crisisDecisions, dailyNoise } = input;

  const results: EngineDayResult[] = [];
  let cumulativeSpend = 0;

  // Latest launchDay across all active campaigns — used for the early-exit guard.
  // Without this, campaigns with launchDay > 3 would never run because the engine
  // exits after 1 consecutive zero-spend day past day 3.
  const maxLaunchDay = campaigns
    .filter(c => !c.isDraft)
    .reduce((max, c) => Math.max(max, c.launchDay ?? 1), 1);

  // ── Scenario-level multipliers (computed once) ──────────────────────────
  const cmBoost =
    cmPitch?.status === "strong" ? 1.15 :
    cmPitch?.status === "decent" ? 1.05 :
    cmPitch?.status === "weak"   ? 0.95 : 1.0;

  const seasonStr  = (scenario.season  ?? "").toString().toLowerCase();
  const seasonMult =
    seasonStr.includes("festival") ? 1.30 :
    seasonStr.includes("post")     ? 0.70 : 1.0;

  const marketStr       = (scenario.market?.name ?? "").toString();
  const competitorCPMMult = /aggressive/i.test(marketStr) ? 1.35 : 1.0;

  const avgMrp = avgMrpFor(scenario);

  // Scenario context for crisis 3 branching in modifierForDay
  const modCtx: ModifierContext = {
    seasonName: (scenario.season ?? "").toString(),
    marketName: marketStr,
  };

  // ── Day loop ──────────────────────────────────────────────────────────────
  for (let d = 1; d <= MAX_DAYS; d++) {
    // Stop once full scenario budget is consumed
    if (cumulativeSpend >= scenario.budget) break;

    // Crisis + noise indices
    const mod = modifierForDay(d, crisisDecisions, modCtx);
    const ni  = Math.min(d - 1, dailyNoise.cpmMult.length - 1);
    const cpmNoise = dailyNoise.cpmMult[ni] ?? 1;
    const ctrNoise = dailyNoise.ctrMult[ni] ?? 1;
    const cvrNoise = dailyNoise.cvrMult[ni] ?? 1;

    const byCampaign: Record<string, CampaignDayMetric> = {};
    let daySpend = 0, dayImp = 0, dayClk = 0, dayAtc = 0, dayUnt = 0, dayRev = 0;

    for (const c of campaigns) {
      if (c.isDraft) continue;

      const launchDay = c.launchDay ?? 1;

      // Campaign not started yet
      if (d < launchDay) continue;

      // Respect endDay for any budget type (overall campaigns have endDay set from duration;
      // daily campaigns set endDay only when the student specified an explicit end date)
      if (c.endDay !== undefined && d > c.endDay) continue;

      // Day-of-week gate (Stories: only deliver on selected days)
      if (c.scheduleType === "days_of_week" && c.selectedDays && c.selectedDays.length > 0) {
        if (!c.selectedDays.includes(simDayToWeekdayIdx(d))) continue;
      }

      // Pause check — support pause/resume windows.
      // pausedAtDay = start of pause window; resumedAtDay = end (null = still paused).
      // Bug2 fix: use ?? null so undefined resumedAtDay is treated as null (still paused).
      const opt       = optimizations[c.id];
      const pausedAt  = opt?.pausedAtDay ?? null;
      const resumedAt = opt?.resumedAtDay ?? null;
      if (pausedAt !== null) {
        const inPauseWindow = d >= pausedAt && (resumedAt === null || d < resumedAt);
        if (inPauseWindow) continue;
      }

      // Stock gate (binary)
      if (!hasStock(c, stockLevels)) continue;

      // Daily budget for this campaign
      let dailyBudget: number;
      if (c.budgetType === "overall") {
        const endDay   = c.endDay ?? 30;
        const totalDays = Math.max(1, endDay - launchDay + 1);
        dailyBudget = c.budget / totalDays;
      } else {
        // "daily" or null → spend the set amount every day
        dailyBudget = c.budget;
      }

      // Bug3 fix: apply student's scale decision (e.g. +25% budget) AND crisis modifier.
      const scaleMultiplier = opt?.scaleMultiplier ?? 1;
      const targetSpend = dailyBudget * scaleMultiplier * mod.spendMult;

      // Don't overshoot the scenario's total budget
      const remaining   = scenario.budget - cumulativeSpend - daySpend;
      if (remaining <= 0) break;
      const actualSpend = Math.min(targetSpend, remaining);

      // Impressions: actualSpend / effectiveCPM × 1000
      // Daypart multiplier: peak-hour selection raises effective CPM (fewer impressions per ₹)
      const dpMult       = daypartCPMMult(c.dayparting ?? [0,1,2,3,4,5,6,7]);
      const effectiveCPM = BASE_CPM * cpmNoise * competitorCPMMult * dpMult;
      const impressions  = (actualSpend / effectiveCPM) * 1000;

      // Reach campaigns are awareness-focused: lower CTR, near-zero CVR.
      // Performance campaigns target high-intent keywords → full CTR + CVR.
      const isReach    = c.objective === "reach";
      const ctrObjMult = isReach ? 0.30 : 1.0;  // reach ~0.45% vs performance ~1.5%
      const cvrObjMult = isReach ? 0.05 : 1.0;  // reach ~0.4%  vs performance ~8%

      // Targeting quality multipliers — make keyword & geography choices matter.
      // kwMult: good keywords boost CTR (right intent) and CVR (buyers not browsers).
      // geoMult: targeting unstocked states → clicks happen but conversions fail.
      const kwMult  = keywordQualityMult(c, scenario.profile);
      const geoMult = geoConversionMult(c, scenario.cityStockMap);

      // Clicks: keyword quality affects who searches & clicks (purchase intent signal)
      const clicks = impressions * BASE_CTR * ctrNoise * ctrObjMult * kwMult.ctrMult;

      // ATCs: keyword quality + geo quality both gate whether clicks convert
      const atcs = clicks * BASE_CVR * cvrNoise * cvrObjMult * cmBoost * seasonMult * mod.revMult * kwMult.cvrMult * geoMult;

      // Units & revenue
      const units   = atcs * ATC_TO_UNITS;
      const revenue = units * avgMrp;

      byCampaign[c.id] = { spend: actualSpend, impressions, clicks, atcs, units, revenue };

      daySpend += actualSpend;
      dayImp   += impressions;
      dayClk   += clicks;
      dayAtc   += atcs;
      dayUnt   += units;
      dayRev   += revenue;
    }

    cumulativeSpend += daySpend;

    results.push({
      day: d,
      spend:       daySpend,
      impressions: dayImp,
      clicks:      dayClk,
      atcs:        dayAtc,
      units:       dayUnt,
      revenue:     dayRev,
      byCampaign,
    });

    // Stop early once past all campaign launch days AND nothing spent.
    // Guard: must be past maxLaunchDay + 1 to avoid killing campaigns that haven't started.
    // Guard: don't stop if any campaign is in an active pause window (paused but not yet resumed)
    // — the student may resume it and keep spending (e.g. after a crisis auto-pause).
    const hasActivePause = campaigns.some((c) => {
      if (c.isDraft) return false;
      const opt = optimizations[c.id];
      return (opt?.pausedAtDay ?? null) !== null && (opt?.resumedAtDay ?? null) === null;
    });
    if (daySpend === 0 && d > maxLaunchDay + 1 && !hasActivePause) break;
  }

  return results;
}
