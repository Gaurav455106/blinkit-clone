import { Scenario, CityName, CITIES } from "@/data/scenarios";
import { CITY_ZONES, zoneAffinity, PinZone } from "@/data/zones";
import { SavedCampaign, CmPitchResult } from "@/context/SimContext";
import { Competitor, CompetitorAction } from "@/data/competitor";

// ---------- ARCHITECTURE ----------
export type ArchType = "A" | "B" | "C" | "D" | "E";
export const ARCH_NAMES: Record<ArchType, string> = {
  A: "Single Master",
  B: "City-Split",
  C: "SKU-Split",
  D: "Matrix",
  E: "Hybrid/Messy",
};

export function detectArchitecture(campaigns: SavedCampaign[]): ArchType {
  if (campaigns.length === 0) return "E";
  if (campaigns.length === 1) {
    const c = campaigns[0];
    if (c.cities.length > 1 && c.skuIds.length > 1) return "A";
    return "E";
  }
  const allSingleCity = campaigns.every((c) => c.cities.length === 1);
  const allSingleSku = campaigns.every((c) => c.skuIds.length === 1);
  if (campaigns.length >= 4 && allSingleCity && allSingleSku) return "D";
  if (allSingleCity) return "B";
  if (allSingleSku) return "C";
  return "E";
}

export function optimalArchitecture(scenario: Scenario, profileId: string): { optimal: ArchType; alternative?: ArchType; reason: string } {
  const cityStocks = Object.values(scenario.cityStockMap);
  const avgOsa = cityStocks.reduce((a, b) => a + b, 0) / cityStocks.length;
  const stockedCities = cityStocks.filter((x) => x > 30).length;
  const highVel = scenario.profile.skus.filter((s) => s.velocity === "High").length;

  if (profileId === "fuelup" || avgOsa < 65) {
    return { optimal: "B", alternative: "D", reason: "Hyperlocal or uneven stock — need granular city control." };
  }
  if (stockedCities === 1) {
    return { optimal: "C", reason: "Only one city has reliable stock — split by SKU within it." };
  }
  if ((profileId === "vitaboost" || profileId === "glow") && scenario.season.name === "Normal Week") {
    return { optimal: "A", reason: "Unknown brand in a calm market — keep it simple, learn first." };
  }
  if (stockedCities >= 3 && highVel >= 3) {
    return { optimal: "D", reason: "Strong stock across cities + multiple hero SKUs — granular control wins." };
  }
  return { optimal: "B", reason: "Balanced setup — city-split offers good control." };
}

export function scoreArchitecture(detected: ArchType, optimal: ArchType, alternative?: ArchType): number {
  if (detected === optimal) return 10;
  if (alternative && detected === alternative) return 6;
  if (detected === "E") return 2;
  return 0;
}

export function architectureMultiplier(detected: ArchType, optimal: ArchType, alternative?: ArchType): number {
  if (detected === optimal) return 1.2;
  if (alternative && detected === alternative) return 1.0;
  return 0.8;
}

// ---------- SEQUENCE ----------
export interface LaunchOrderEntry { campaignId: string; day: number; objective: "performance" | "reach" | null }

export function detectSequence(campaigns: SavedCampaign[]): "reach_then_perf" | "perf_then_reach" | "parallel" | "perf_only" | "reach_only" | "none" {
  if (campaigns.length === 0) return "none";
  const sorted = [...campaigns].sort((a, b) => (a.launchDay ?? 1) - (b.launchDay ?? 1));
  const objs = sorted.map((c) => c.objective);
  const hasR = objs.includes("reach");
  const hasP = objs.includes("performance");
  if (!hasR && hasP) return "perf_only";
  if (!hasP && hasR) return "reach_only";
  if (hasR && hasP) {
    const firstR = sorted.find((c) => c.objective === "reach")?.launchDay ?? 1;
    const firstP = sorted.find((c) => c.objective === "performance")?.launchDay ?? 1;
    if (Math.abs(firstR - firstP) <= 1) return "parallel";
    return firstR < firstP ? "reach_then_perf" : "perf_then_reach";
  }
  return "none";
}

export function scoreSequence(profileId: string, seq: ReturnType<typeof detectSequence>): { score: number; note: string } {
  const isNew = profileId === "glow" || profileId === "vitaboost";
  if (isNew) {
    if (seq === "reach_then_perf") return { score: 5, note: "Reach-then-Performance — correct for a new brand. Built recall first, then captured intent." };
    if (seq === "perf_then_reach" || seq === "perf_only") return { score: 0, note: "Performance-first for a new brand — customers don't search you yet, CTR suffers." };
    if (seq === "parallel") return { score: 2, note: "Parallel launch — Reach got diluted, didn't build brand before Performance fired." };
    return { score: 3, note: "Reach only — built awareness but didn't capture intent." };
  }
  if (profileId === "tinybuddy") {
    return { score: seq === "perf_then_reach" || seq === "perf_only" ? 5 : 3, note: "Volume goal — Performance-first works." };
  }
  // ROAS-first profiles
  if (seq === "perf_then_reach" || seq === "perf_only") return { score: 5, note: "Performance-first matches a ROAS goal — captured existing demand." };
  if (seq === "reach_then_perf") return { score: 3, note: "Reach-first is safe but slow for a ROAS goal." };
  return { score: 3, note: "Acceptable sequencing." };
}

export function sequenceMultiplier(profileId: string, seq: ReturnType<typeof detectSequence>, week: number): { performance: number; reach: number } {
  const isNew = profileId === "glow" || profileId === "vitaboost";
  if (isNew) {
    if (seq === "reach_then_perf" && week >= 2) return { performance: 1.4, reach: 1.0 };
    if (seq === "perf_then_reach" || seq === "perf_only") {
      return week <= 2 ? { performance: 0.6, reach: 1.0 } : { performance: 0.9, reach: 1.0 };
    }
  }
  return { performance: 1.0, reach: 1.0 };
}

// ---------- CANNIBALIZATION ----------
export interface CannibalPair { keyword: string; city: string; campaignIds: string[] }

export function detectCannibalization(campaigns: SavedCampaign[]): CannibalPair[] {
  const map = new Map<string, string[]>();
  for (const c of campaigns) {
    for (const k of c.keywords) {
      for (const city of c.cities) {
        const key = `${k}|${city}`;
        const arr = map.get(key) || [];
        arr.push(c.id);
        map.set(key, arr);
      }
    }
  }
  const pairs: CannibalPair[] = [];
  map.forEach((ids, key) => {
    if (ids.length > 1) {
      const [keyword, city] = key.split("|");
      pairs.push({ keyword, city, campaignIds: ids });
    }
  });
  return pairs;
}

export function cannibalizationDrag(pairs: CannibalPair[], resolvedKeys: Set<string>): number {
  const unresolved = pairs.filter((p) => !resolvedKeys.has(`${p.keyword}|${p.city}`));
  if (unresolved.length === 0) return 1.0;
  if (unresolved.length === 1) return 0.85;
  return 0.7;
}

export function scoreCannibalization(pairs: CannibalPair[], resolvedKeys: Set<string>): number {
  const unresolved = pairs.filter((p) => !resolvedKeys.has(`${p.keyword}|${p.city}`));
  if (pairs.length === 0) return 5;
  if (unresolved.length === 0) return 3;
  if (unresolved.length === 1) return 0;
  return -3;
}

// ---------- ZONES / CLUSTERS ----------
export interface ZoneMetric {
  city: string;
  zone: string;
  roas: number;
  spend: number;
  impressions: number;
}
export interface ClusterInsight {
  city: string;
  topZones: { zone: string; roas: number }[];
  avgRoas: number;
  restAvgRoas: number;
  ratio: number;
}

export function computeZoneMetrics(
  city: CityName, citySpend: number, cityImp: number, cityRevenue: number, profileId: string,
): ZoneMetric[] {
  const zones = CITY_ZONES[city] || [];
  if (zones.length === 0) return [];
  const aff = zones.map((z) => zoneAffinity(profileId, z.traits));
  const total = aff.reduce((a, b) => a + b, 0);
  return zones.map((z, i) => {
    const share = aff[i] / total;
    const impZ = cityImp * share;
    const spendZ = citySpend * share;
    const revZ = cityRevenue * (aff[i] * aff[i]) / (aff.reduce((s, x) => s + x * x, 0)); // emphasize high-affinity zones in revenue
    return { city, zone: z.name, roas: spendZ > 0 ? +(revZ / spendZ).toFixed(2) : 0, spend: Math.round(spendZ), impressions: Math.round(impZ) };
  });
}

export function detectClusters(zoneMetrics: ZoneMetric[]): ClusterInsight[] {
  const byCity = new Map<string, ZoneMetric[]>();
  for (const z of zoneMetrics) {
    const arr = byCity.get(z.city) || [];
    arr.push(z);
    byCity.set(z.city, arr);
  }
  const insights: ClusterInsight[] = [];
  byCity.forEach((zones, city) => {
    if (zones.length < 3) return;
    const sorted = [...zones].sort((a, b) => b.roas - a.roas);
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    const topAvg = top.reduce((s, x) => s + x.roas, 0) / top.length;
    const restAvg = rest.length ? rest.reduce((s, x) => s + x.roas, 0) / rest.length : 0.1;
    const ratio = topAvg / Math.max(0.1, restAvg);
    if (ratio >= 3 && topAvg >= 2) {
      insights.push({ city, topZones: top.map((t) => ({ zone: t.zone, roas: t.roas })), avgRoas: +topAvg.toFixed(2), restAvgRoas: +restAvg.toFixed(2), ratio: +ratio.toFixed(1) });
    }
  });
  return insights;
}

export interface ClusterReaction {
  city: string;
  action: "cluster_bid" | "cluster_daypart" | "expand_similar" | "stay_broad";
  tokenCost: number;
}
export function scoreClusterReactions(detected: ClusterInsight[], reactions: ClusterReaction[]): number {
  if (detected.length === 0) return 3;
  let pts = 0;
  for (const ins of detected) {
    const r = reactions.find((x) => x.city === ins.city);
    if (!r) { pts += 0; continue; }
    if (r.action === "cluster_daypart") pts += 5;
    else if (r.action === "cluster_bid") pts += 4;
    else if (r.action === "expand_similar") pts += 3;
  }
  return Math.min(5, pts);
}

// ---------- COMPETITOR AI ----------
export function nextCompetitorAction(week: number, competitor: Competitor, lastWeekTopKeyword?: string, lastWeekTopCity?: string): CompetitorAction | null {
  if (!lastWeekTopKeyword && !lastWeekTopCity) return null;
  const aggrFactor = competitor.aggressiveness === "high" ? 1.0 : competitor.aggressiveness === "medium" ? 0.7 : 0.4;
  // Random selection biased by aggressiveness
  const roll = Math.random();
  if (roll < 0.4 * aggrFactor && lastWeekTopKeyword) {
    return {
      week, type: "kw_bid",
      description: `Started bidding on '${lastWeekTopKeyword}' — your CPC up 30%.`,
      impact: { cpcMult: 1.3 },
    };
  }
  if (roll < 0.75 * aggrFactor && lastWeekTopCity) {
    return {
      week, type: "city_attack",
      description: `Launched a campaign in ${lastWeekTopCity} — your impression share down 20%.`,
      impact: { impShareMult: 0.8 },
    };
  }
  if (roll < 0.9 * aggrFactor) {
    return {
      week, type: "price_cut",
      description: `Cut prices 15% across the category — your CVR dropped 10%.`,
      impact: { cvrMult: 0.9 },
    };
  }
  return null;
}

// ---------- A/B TESTING ----------
export interface AbTest { campaignId: string; week: number; variable: string; winner: "A" | "B"; ctrMultiplier: number }

export function abTestCtrMultiplier(tests: AbTest[], campaignId: string, currentWeek: number): number {
  const t = tests.find((x) => x.campaignId === campaignId && x.week < currentWeek);
  return t ? t.ctrMultiplier : 1.0;
}

export function scoreAbTests(tests: AbTest[]): number {
  if (tests.length === 0) return 1;
  if (tests.length <= 2) return 3;
  return 0;
}

// ---------- CREATIVE FRESHNESS ----------
export function creativeFreshness(currentDay: number, hasAbTest: boolean): number {
  if (hasAbTest) return 1.0;
  if (currentDay <= 10) return 1.0;
  if (currentDay <= 20) return 0.95;
  return 0.85;
}

// ---------- BUDGET PACING ----------
export interface PacingInfo { campaignId: string; cumulativeSpend: number; budget: number; pacePct: number; projectedExhaustionDay: number | null; exhausted: boolean }

export function computePacing(campaignId: string, budget: number, cumulativeSpend: number, currentDay: number): PacingInfo {
  const pacePct = budget > 0 ? cumulativeSpend / budget : 0;
  const dailyRate = currentDay > 0 ? cumulativeSpend / currentDay : 0;
  const remaining = budget - cumulativeSpend;
  const projectedExhaustionDay = dailyRate > 0 && remaining > 0 ? Math.min(60, Math.round(currentDay + remaining / dailyRate)) : (remaining <= 0 ? currentDay : null);
  return { campaignId, cumulativeSpend, budget, pacePct: +(pacePct * 100).toFixed(1), projectedExhaustionDay, exhausted: cumulativeSpend >= budget };
}

// ---------- TOKEN SCORING ----------
export function scoreTokenEconomy(used: number): number {
  if (used >= 6 && used <= 9) return 5;
  if (used === 10) return 3;
  if (used <= 2) return 0;
  return 3;
}

// ---------- BUDGET EXHAUSTION SCORING ----------
export function scoreExhaustionManagement(exhaustedCampaigns: { campaignId: string; was: "winning" | "losing"; caught: boolean }[]): number {
  let pts = 3;
  for (const e of exhaustedCampaigns) {
    if (e.was === "winning" && !e.caught) pts -= 3;
    if (e.was === "winning" && e.caught) pts += 1;
    if (e.was === "losing" && e.caught) pts += 1;
  }
  return Math.max(0, Math.min(3, pts));
}
