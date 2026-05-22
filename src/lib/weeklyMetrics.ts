import { Scenario, CityName, CITIES } from "@/data/scenarios";
import { SavedCampaign, CmPitchResult, CampaignOptimization, StockMap, AbTest } from "@/context/SimContext";
import {
  detectArchitecture, optimalArchitecture, architectureMultiplier,
  detectSequence, sequenceMultiplier,
  detectCannibalization, cannibalizationDrag,
  computeZoneMetrics, detectClusters, ClusterInsight, ZoneMetric,
  abTestCtrMultiplier, creativeFreshness,
} from "@/lib/phase3";
import { CompetitorAction } from "@/data/competitor";

export interface CityMetric {
  city: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  atcs: number;
  units: number;
  roas: number;
  health: "strong" | "average" | "failing";
}
export interface HourMetric {
  block: string;
  active: boolean;
  spend: number;
  clicks: number;
  roas: number;
  intensity: number; // 0..1
}
export interface KeywordMetric {
  name: string;
  spend: number;
  impressions: number;
  ctr: number;
  roas: number;
}
export interface CampaignWeekMetric {
  campaignId: string;
  name: string;
  active: boolean;
  duration: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  atcs: number;
  units: number;
  revenue: number;
  roas: number;
  status: "strong" | "average" | "failing" | "paused";
  dailySpend: number[]; // length 7
  byCity: CityMetric[];
  byHour: HourMetric[];
  byKeyword: KeywordMetric[];
  insights: string[];
}
export interface StockAlert {
  skuId: string;
  skuName: string;
  city: string;
  status: "low" | "oos";
  remaining: number;
}
export interface PacingInfo {
  campaignId: string;
  cumulativeSpend: number;
  budget: number;
  pacePct: number;
  projectedExhaustionDay: number | null;
  exhausted: boolean;
}
export interface WeekResult {
  week: number;
  startDay: number;
  endDay: number;
  campaigns: CampaignWeekMetric[];
  dailySpend: number[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    atcs: number;
    units: number;
    revenue: number;
    roas: number;
  };
  stockAlerts: StockAlert[];
  // Phase 3
  clusters: ClusterInsight[];
  pacing: PacingInfo[];
  cannibalPairs: { keyword: string; city: string; campaignIds: string[] }[];
  zoneMetrics: ZoneMetric[];
}

const HOUR_BLOCKS = [
  { block: "6-9 AM", start: 6 },
  { block: "9 AM-12 PM", start: 9 },
  { block: "12-3 PM", start: 12 },
  { block: "3-6 PM", start: 15 },
  { block: "6-9 PM", start: 18 },
  { block: "9 PM-12 AM", start: 21 },
  { block: "12-3 AM", start: 0 },
  { block: "3-6 AM", start: 3 },
];

// Map product category to peak start hours
function peakBlocks(category: string): string[] {
  const c = category.toLowerCase();
  if (c.includes("baby")) return ["9 AM-12 PM"];
  if (c.includes("snack")) return ["3-6 PM", "6-9 PM"];
  if (c.includes("pet")) return ["6-9 AM", "6-9 PM"];
  if (c.includes("supplement") || c.includes("protein") || c.includes("fitness")) return ["6-9 AM", "6-9 PM"];
  if (c.includes("skincare")) return ["9 AM-12 PM", "6-9 PM"];
  return ["6-9 AM", "9 AM-12 PM", "6-9 PM"];
}

function seasonMult(name: string, category: string): number {
  if (name === "Festival Surge") return 1.4;
  if (name === "Post-Festival Slowdown") return 0.7;
  if (name === "Summer Season" && /skin|baby|beverage/i.test(category)) return 1.1;
  if (name === "New Year Health Spike" && /supplement|protein|fitness/i.test(category)) return 1.2;
  return 1.0;
}
function competitorDragFor(name: string): number {
  if (name === "Aggressive Competitor") return 0.7;
  if (name === "Price War in Category") return 0.85;
  return 1.0;
}
function osaMult(osa: number): number {
  if (osa < 30) return 0.2;
  if (osa < 60) return 0.5;
  if (osa < 80) return 1.0;
  return 1.1;
}

function startingStock(velocity: string): number {
  if (velocity === "High") return 1000;
  if (velocity === "Medium") return 600;
  return 300;
}

export function buildInitialStock(scenario: Scenario): StockMap {
  const map: StockMap = {};
  for (const sku of scenario.profile.skus) {
    map[sku.id] = {};
    for (const c of CITIES) {
      const osa = scenario.cityStockMap[c] || 0;
      const base = startingStock(sku.velocity);
      map[sku.id][c] = Math.round(base * (osa / 100));
    }
  }
  return map;
}

interface ComputeInput {
  scenario: Scenario;
  campaigns: SavedCampaign[];
  cmPitch: CmPitchResult | null;
  opts: Record<string, CampaignOptimization>;
  stockLevels: StockMap;
  week: number;
}

export function computeWeek(input: ComputeInput): { result: WeekResult; newStock: StockMap } {
  const { scenario, campaigns, cmPitch, opts, week } = input;
  const newStock: StockMap = JSON.parse(JSON.stringify(input.stockLevels));
  const season = seasonMult(scenario.season.name, scenario.profile.category);
  const cDrag = competitorDragFor(scenario.market.name);
  const cmBonus = cmPitch?.status === "strong" ? 1.15 : cmPitch?.status === "decent" ? 1.0 : cmPitch?.status === "weak" ? 0.9 : 1.0;

  const campaignMetrics: CampaignWeekMetric[] = campaigns.map((c) => {
    const opt = opts[c.id] || { paused: false, scaleMultiplier: 1, dayparting: "24_7" as const };
    const active = !opt.paused;
    const weekBudget = (c.budget / 30) * 7 * (opt.scaleMultiplier || 1) * (active ? 1 : 0);
    const dailyBudget = weekBudget / 7;

    // City-level computation
    const cityList = (c.cities.length ? c.cities : (Object.keys(scenario.cityStockMap) as CityName[])) as string[];
    const baseImpDaily = dailyBudget * 100;

    const objectiveMatch = c.objective === scenario.profile.optimalObjective ? 1.3 : 0.6;
    const goodKws = scenario.profile.goodKeywords;
    const goodHits = c.keywords.filter((k) => goodKws.includes(k)).length;
    const riskyHits = c.keywords.length - goodHits;
    const kwQuality = c.keywords.length === 0 ? 1 : goodHits === c.keywords.length ? 1.5 : goodHits >= riskyHits ? 1.0 : 0.4;
    const formatMatch = c.adFormat === scenario.profile.optimalAdFormat ? 1.3 : 0.8;
    const cohortMatch = c.objective === "reach" ? (c.adFormat === scenario.profile.optimalAdFormat ? 1.4 : 0.6) : 1.0;
    const peaks = peakBlocks(scenario.profile.category);
    const dayMult = opt.dayparting === "peak_only" ? 1.4 : 1.0;
    const ctrBase = 0.012 * kwQuality * dayMult * formatMatch * cohortMatch;

    let totImp = 0, totClicks = 0, totSpend = 0, totAtcs = 0, totUnits = 0, totRevenue = 0;
    const byCity: CityMetric[] = [];

    for (const city of cityList) {
      const osa = scenario.cityStockMap[city as CityName] ?? scenario.inventory.osa;
      const cityShare = 1 / cityList.length;
      const osaM = osaMult(osa) * (cmPitch?.osaBoost ? 1.1 : 1);
      const cityMatch = (cmPitch?.approvedCities.includes(city as CityName) ?? true) && osa > 0 ? 1.0 : 0.1;
      const dailyImpCity = baseImpDaily * cityShare * osaM * objectiveMatch * cmBonus * cDrag * season * cityMatch;
      const weekImpCity = dailyImpCity * 7;
      const clicksCity = weekImpCity * ctrBase;
      const atcRate = 0.25 * (scenario.profile.skus.some((s) => s.velocity === "High") ? 1.1 : 0.9);
      const atcsCity = clicksCity * atcRate;
      const purchaseRate = 0.6;

      // Stock cap per SKU in this city
      let unitsCity = 0;
      const validSkus = (c.skuIds.length ? c.skuIds : scenario.profile.skus.map((s) => s.id));
      const atcsPerSku = atcsCity / Math.max(1, validSkus.length);
      for (const sid of validSkus) {
        const wantUnits = atcsPerSku * purchaseRate;
        const stockLeft = newStock[sid]?.[city] ?? 0;
        const sold = Math.min(wantUnits, stockLeft);
        if (newStock[sid]) newStock[sid][city] = Math.max(0, stockLeft - Math.round(sold));
        unitsCity += sold;
      }

      const cpm = 80 * cDrag * season;
      const spendCity = Math.min(dailyBudget * cityShare * 7, (weekImpCity / 1000) * cpm);
      const avgMrp = (c.skuIds.length ? c.skuIds : scenario.profile.skus.map((s) => s.id))
        .map((id) => scenario.profile.skus.find((s) => s.id === id)?.mrp ?? 0)
        .reduce((a, b) => a + b, 0) / Math.max(1, c.skuIds.length || scenario.profile.skus.length);
      const revenueCity = unitsCity * avgMrp;
      const roasCity = spendCity > 0 ? revenueCity / spendCity : 0;
      const health: CityMetric["health"] = roasCity >= 3 ? "strong" : roasCity >= 1.5 ? "average" : "failing";

      totImp += weekImpCity;
      totClicks += clicksCity;
      totSpend += spendCity;
      totAtcs += atcsCity;
      totUnits += unitsCity;
      totRevenue += revenueCity;
      byCity.push({
        city,
        spend: Math.round(spendCity),
        impressions: Math.round(weekImpCity),
        clicks: Math.round(clicksCity),
        ctr: ctrBase * 100,
        atcs: Math.round(atcsCity),
        units: Math.round(unitsCity),
        roas: +roasCity.toFixed(2),
        health,
      });
    }

    const status: CampaignWeekMetric["status"] = !active ? "paused" :
      (totSpend > 0 && totRevenue / totSpend >= 3) ? "strong" :
      (totSpend > 0 && totRevenue / totSpend >= 1.5) ? "average" : "failing";

    // daily spend distribution (slight variance)
    const variance = [0.9, 1.0, 1.05, 1.1, 1.05, 0.95, 0.95];
    const dailySpendArr = variance.map((v) => Math.round((totSpend / 7) * v));

    // hour blocks
    const byHour: HourMetric[] = HOUR_BLOCKS.map((b) => {
      const isPeak = peaks.includes(b.block);
      const dead = ["12-3 AM", "3-6 AM"].includes(b.block);
      const isActive = opt.dayparting === "peak_only" ? isPeak : true;
      const share = !isActive ? 0 : isPeak ? 0.25 : dead ? 0.04 : 0.10;
      const spendH = totSpend * share;
      const clicksH = totClicks * share;
      const roasH = isPeak ? (totSpend ? (totRevenue / totSpend) * 1.4 : 0) : dead ? 0.3 : (totSpend ? totRevenue / totSpend : 0);
      return {
        block: b.block,
        active: isActive,
        spend: Math.round(spendH),
        clicks: Math.round(clicksH),
        roas: +roasH.toFixed(2),
        intensity: Math.min(1, roasH / 5),
      };
    });

    // keywords/cohorts
    const items = c.objective === "reach" ? ["Pet Owners", "Fitness Enthusiasts", "New Parents", "Skincare Buyers"].slice(0, 3) : c.keywords;
    const byKeyword: KeywordMetric[] = items.map((k, i) => {
      const isGood = c.objective !== "reach" && goodKws.includes(k);
      const weight = isGood ? 1.4 : c.objective === "reach" ? 1.0 : 0.5;
      const share = weight / items.reduce((s, kw) => s + (c.objective !== "reach" && goodKws.includes(kw) ? 1.4 : c.objective === "reach" ? 1.0 : 0.5), 0);
      const kSpend = totSpend * share;
      const kImp = totImp * share;
      const kRoas = isGood ? (totSpend ? (totRevenue / totSpend) * 1.3 : 0) : c.objective === "reach" ? (totSpend ? totRevenue / totSpend : 0) : (totSpend ? (totRevenue / totSpend) * 0.5 : 0);
      return {
        name: k,
        spend: Math.round(kSpend),
        impressions: Math.round(kImp),
        ctr: +(ctrBase * 100 * (isGood ? 1.3 : 0.7)).toFixed(2),
        roas: +kRoas.toFixed(2),
      };
    });

    // insights
    const insights: string[] = [];
    if (byCity.length >= 2) {
      const sorted = [...byCity].sort((a, b) => b.roas - a.roas);
      const top = sorted[0], bot = sorted[sorted.length - 1];
      if (top.roas > 0 && bot.roas > 0 && top.roas > bot.roas * 2) {
        insights.push(`💡 ${top.city} is performing ${(top.roas / Math.max(0.1, bot.roas)).toFixed(1)}x better than ${bot.city}. Consider scaling budget.`);
      }
      if (bot.roas < 1 && bot.spend > 1000) {
        insights.push(`⚠️ ${bot.city} has ${bot.roas.toFixed(1)}x ROAS — burning ₹${bot.spend.toLocaleString("en-IN")}.`);
      }
      const totRev = byCity.reduce((s, x) => s + x.spend * x.roas, 0);
      const topRev = top.spend * top.roas;
      if (topRev > totRev * 0.5) insights.push(`🔥 ${top.city} is your top performer — ${Math.round((topRev / Math.max(1, totRev)) * 100)}% of revenue from here.`);
    }
    if (opt.dayparting !== "peak_only") {
      insights.push(`💡 Consider dayparting to peak hours only — could improve ROAS by ~40%.`);
    }
    const deadSpend = byHour.filter((h) => ["12-3 AM", "3-6 AM"].includes(h.block)).reduce((s, h) => s + h.spend, 0);
    if (deadSpend > 1000 && opt.dayparting !== "peak_only") {
      insights.push(`💸 You spent ₹${deadSpend.toLocaleString("en-IN")} in dead hours (12 AM-6 AM) with low ROAS — wasted budget.`);
    }
    if (byKeyword.length) {
      const topK = [...byKeyword].sort((a, b) => b.roas - a.roas)[0];
      const botK = [...byKeyword].sort((a, b) => a.roas - b.roas)[0];
      if (topK.roas > 1.5) insights.push(`✅ '${topK.name}': ROAS ${topK.roas.toFixed(1)}x — your top driver.`);
      if (botK.roas < 1 && botK.spend > 500) insights.push(`❌ '${botK.name}': ROAS ${botK.roas.toFixed(1)}x — burning ₹${botK.spend.toLocaleString("en-IN")}. Consider pausing.`);
    }

    return {
      campaignId: c.id,
      name: c.name,
      active,
      duration: `7 days`,
      budget: c.budget,
      spend: Math.round(totSpend),
      impressions: Math.round(totImp),
      clicks: Math.round(totClicks),
      ctr: +(totImp ? (totClicks / totImp) * 100 : 0).toFixed(2),
      atcs: Math.round(totAtcs),
      units: Math.round(totUnits),
      revenue: Math.round(totRevenue),
      roas: +(totSpend ? totRevenue / totSpend : 0).toFixed(2),
      status,
      dailySpend: dailySpendArr,
      byCity,
      byHour,
      byKeyword,
      insights,
    };
  });

  // Aggregate
  const totals = campaignMetrics.reduce((acc, m) => ({
    spend: acc.spend + m.spend,
    impressions: acc.impressions + m.impressions,
    clicks: acc.clicks + m.clicks,
    atcs: acc.atcs + m.atcs,
    units: acc.units + m.units,
    revenue: acc.revenue + m.revenue,
    roas: 0,
  }), { spend: 0, impressions: 0, clicks: 0, atcs: 0, units: 0, revenue: 0, roas: 0 });
  totals.roas = totals.spend ? +(totals.revenue / totals.spend).toFixed(2) : 0;

  const dailySpend = Array.from({ length: 7 }, (_, i) =>
    campaignMetrics.reduce((s, m) => s + (m.dailySpend[i] || 0), 0));

  // Stock alerts
  const stockAlerts: StockAlert[] = [];
  for (const sku of scenario.profile.skus) {
    for (const city of CITIES) {
      const r = newStock[sku.id]?.[city] ?? 0;
      const startVal = startingStock(sku.velocity);
      if (r === 0 && (scenario.cityStockMap[city] || 0) > 0) {
        stockAlerts.push({ skuId: sku.id, skuName: sku.name, city, status: "oos", remaining: 0 });
      } else if (r > 0 && r < 100 && startVal > 100) {
        stockAlerts.push({ skuId: sku.id, skuName: sku.name, city, status: "low", remaining: r });
      }
    }
  }

  const startDay = (week - 1) * 7 + 1;
  const endDay = week * 7;

  // Phase 3: zones + clusters
  const zoneMetrics: ZoneMetric[] = [];
  for (const cm of campaignMetrics) {
    for (const cb of cm.byCity) {
      const revenue = cb.spend * cb.roas;
      zoneMetrics.push(...computeZoneMetrics(cb.city as CityName, cb.spend, cb.impressions, revenue, scenario.profile.id));
    }
  }
  // aggregate by city+zone
  const zMap = new Map<string, ZoneMetric>();
  for (const z of zoneMetrics) {
    const k = `${z.city}|${z.zone}`;
    const ex = zMap.get(k);
    if (!ex) zMap.set(k, { ...z });
    else { ex.spend += z.spend; ex.impressions += z.impressions; ex.roas = (ex.roas + z.roas) / 2; }
  }
  const aggZones = Array.from(zMap.values());
  const clusters = detectClusters(aggZones);

  // pacing per campaign
  const pacing: PacingInfo[] = campaignMetrics.map((m) => {
    const dayNow = endDay;
    const cumulative = m.spend * week; // engine recomputes week as standalone, scale up to approximate cumulative
    const pacePct = m.budget > 0 ? +((cumulative / m.budget) * 100).toFixed(1) : 0;
    const dailyRate = dayNow > 0 ? cumulative / dayNow : 0;
    const remaining = m.budget - cumulative;
    const projectedExhaustionDay = dailyRate > 0 && remaining > 0
      ? Math.min(60, Math.round(dayNow + remaining / dailyRate))
      : (remaining <= 0 ? dayNow : null);
    return { campaignId: m.campaignId, cumulativeSpend: Math.round(cumulative), budget: m.budget, pacePct, projectedExhaustionDay, exhausted: cumulative >= m.budget };
  });

  const cannibalPairs = detectCannibalization(campaigns);

  return {
    result: { week, startDay, endDay, campaigns: campaignMetrics, dailySpend, totals, stockAlerts, clusters, pacing, cannibalPairs, zoneMetrics: aggZones },
    newStock,
  };
}
