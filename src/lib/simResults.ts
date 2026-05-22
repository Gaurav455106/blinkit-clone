import { Scenario, CityName } from "@/data/scenarios";
import { SavedCampaign, CmPitchResult } from "@/context/SimContext";

export interface CampaignMetrics {
  campaignId: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  atcs: number;
  units: number;
  spend: number;
  revenue: number;
  roas: number;
  status: "strong" | "average" | "failing";
}

export interface Aggregate {
  impressions: number;
  clicks: number;
  ctr: number;
  units: number;
  spend: number;
  revenue: number;
  roas: number;
  reach: number;
  brandedLift: number;
  cvr: number;
  sellThrough: number;
}

export interface SimRunResult {
  perCampaign: CampaignMetrics[];
  totals: Aggregate;
  goalRows: { label: string; goal: number; actual: number; unit: string; pct: number }[];
  achievementPct: number;
  decisionScore: { label: string; earned: number; max: number }[];
  decisionTotal: number;
  rights: string[];
  wrongs: string[];
  verdict: { tone: "good" | "warn" | "bad"; quote: string };
}

function avgOsaForCities(scenario: Scenario, cities: string[], osaBoost: boolean): number {
  const macros = (Object.keys(scenario.cityStockMap) as CityName[]);
  const matched = macros.filter((m) => cities.includes(m));
  const base = matched.length ? matched.reduce((s, c) => s + scenario.cityStockMap[c], 0) / matched.length : scenario.inventory.osa;
  return Math.min(100, base * (osaBoost ? 1.1 : 1)) / 100;
}

export function simulateRun(scenario: Scenario, campaigns: SavedCampaign[], cm: CmPitchResult | null): SimRunResult {
  const seasonMult = scenario.season.name === "Festival Surge" ? 1.3
    : scenario.season.name === "Post-Festival Slowdown" ? 0.7 : 1.0;
  const competitorDrag = scenario.market.name === "Aggressive Competitor" ? 0.7 : 1.0;
  const cmBonus = cm?.status === "strong" ? 1.15 : 1.0;

  const perCampaign: CampaignMetrics[] = campaigns.map((c) => {
    const osaFactor = avgOsaForCities(scenario, c.cities, !!cm?.osaBoost);
    const objectiveMatch = c.objective === scenario.profile.optimalObjective ? 1.3 : 0.6;
    const baseImp = (c.budget || 0) * 100;
    const impressions = Math.round(baseImp * osaFactor * objectiveMatch * cmBonus * competitorDrag * seasonMult);

    const goodKws = scenario.profile.goodKeywords;
    const goodHits = c.keywords.filter((k) => goodKws.includes(k)).length;
    const riskyHits = c.keywords.length - goodHits;
    const kwQuality = c.keywords.length === 0 ? 1 : goodHits >= riskyHits ? 1.5 : 0.5;
    const formatMatch = c.adFormat === scenario.profile.optimalAdFormat ? 1.3 : 0.7;

    const ctr = 0.012 * kwQuality * formatMatch;
    const clicks = Math.round(impressions * ctr);
    const atcs = Math.round(clicks * 0.25);
    const units = Math.round(atcs * 0.6 * osaFactor);
    const spend = Math.min(c.budget || 0, Math.round((impressions / 1000) * 80 * competitorDrag));
    const avgMrp = c.skuIds.length
      ? c.skuIds.map((id) => scenario.profile.skus.find((s) => s.id === id)?.mrp ?? 0).reduce((a, b) => a + b, 0) / c.skuIds.length
      : 0;
    const revenue = Math.round(units * avgMrp);
    const roas = spend > 0 ? revenue / spend : 0;
    const status: CampaignMetrics["status"] = roas >= 3 ? "strong" : roas >= 1.5 ? "average" : "failing";

    return { campaignId: c.id, name: c.name, impressions, clicks, ctr: ctr * 100, atcs, units, spend, revenue, roas, status };
  });

  const totals: Aggregate = perCampaign.reduce((acc, m) => ({
    impressions: acc.impressions + m.impressions,
    clicks: acc.clicks + m.clicks,
    ctr: 0,
    units: acc.units + m.units,
    spend: acc.spend + m.spend,
    revenue: acc.revenue + m.revenue,
    roas: 0,
    reach: acc.reach + Math.round(m.impressions * 0.4),
    brandedLift: 0,
    cvr: 0,
    sellThrough: 0,
  }), { impressions: 0, clicks: 0, ctr: 0, units: 0, spend: 0, revenue: 0, roas: 0, reach: 0, brandedLift: 0, cvr: 0, sellThrough: 0 });

  totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.roas = totals.spend ? totals.revenue / totals.spend : 0;
  totals.cvr = totals.clicks ? (totals.units / totals.clicks) * 100 : 0;
  totals.brandedLift = Math.round(Math.min(50, totals.impressions / 200000));
  totals.sellThrough = Math.min(100, Math.round((totals.units / 1500) * 100));

  // Map goals to actuals
  const goalRows = scenario.clientGoals.metrics.map((m) => {
    let actual = 0;
    switch (m.label) {
      case "ROAS": actual = +totals.roas.toFixed(2); break;
      case "Units sold":
      case "Units": actual = totals.units; break;
      case "Sell-through": actual = totals.sellThrough; break;
      case "Impressions": actual = totals.impressions; break;
      case "CTR": actual = +totals.ctr.toFixed(2); break;
      case "Branded search lift": actual = totals.brandedLift; break;
      case "Reach": actual = totals.reach; break;
      case "Category awareness lift": actual = Math.round(totals.brandedLift * 0.7); break;
      case "CVR": actual = +totals.cvr.toFixed(2); break;
      case "Repeat purchase": actual = Math.round(Math.min(40, totals.units / 50)); break;
      case "Reduce aging units": actual = totals.units; break;
      case "Minimum ROAS": actual = +totals.roas.toFixed(2); break;
    }
    const pct = m.target > 0 ? Math.min(150, (actual / m.target) * 100) : 0;
    return { label: m.label, goal: m.target, actual, unit: m.unit, pct: Math.round(pct) };
  });

  const achievementPct = goalRows.length
    ? Math.round(goalRows.reduce((s, r) => s + r.pct, 0) / goalRows.length)
    : 0;

  // Decision score
  const objMatches = campaigns.some((c) => c.objective === scenario.profile.optimalObjective);
  const allCities = campaigns.flatMap((c) => c.cities);
  const noBadCities = allCities.every((c) => (scenario.cityStockMap as any)[c] > 0);
  const skuCount = new Set(campaigns.flatMap((c) => c.skuIds)).size;
  const kwAll = campaigns.flatMap((c) => c.keywords);
  const goodKw = kwAll.filter((k) => scenario.profile.goodKeywords.includes(k)).length;
  const kwGood = kwAll.length ? goodKw / kwAll.length >= 0.6 : false;

  const decisionScore = [
    { label: "Brief comprehension", earned: objMatches ? 20 : 8, max: 20 },
    { label: "CM Pitch quality", earned: cm?.pitchScore ?? 0, max: 15 },
    { label: "City selection", earned: noBadCities ? 15 : 5, max: 15 },
    { label: "SKU selection focus", earned: skuCount <= 2 ? 15 : skuCount === 3 ? 10 : 5, max: 15 },
    { label: "Keyword quality", earned: kwGood ? 15 : 7, max: 15 },
    { label: "Budget allocation", earned: campaigns.length >= 1 && campaigns.length <= 3 ? 10 : 5, max: 10 },
    { label: "Goal achievement", earned: achievementPct >= 90 ? 10 : achievementPct >= 70 ? 7 : achievementPct >= 50 ? 4 : 1, max: 10 },
  ];
  const decisionTotal = decisionScore.reduce((s, d) => s + d.earned, 0);

  const rights: string[] = [];
  const wrongs: string[] = [];
  if (objMatches) rights.push(`Chose ${scenario.profile.optimalObjective} which matched the client's ${scenario.profile.goalType}`);
  if (cm?.status === "strong") rights.push("Strong CM pitch — premium shelf placement and OSA boost");
  if (noBadCities) rights.push("Selected only stocked cities — no wasted budget");
  if (skuCount <= 2) rights.push("Focused SKU selection — concentrated impact");
  if (kwGood) rights.push("Mostly on-target keywords");

  if (!objMatches) wrongs.push(`Wrong objective — ${scenario.profile.optimalObjective} was the right call`);
  if (!noBadCities) wrongs.push("Picked cities with zero stock — wasted impressions");
  if (skuCount > 3) wrongs.push("Spread budget across too many SKUs — diluted impact");
  if (!kwGood && kwAll.length) wrongs.push("Selected too many risky keywords — competitive category, expensive clicks");
  if (cm?.status === "rejected" || cm?.status === "weak") wrongs.push("CM had concerns about your pitch");

  let verdict: SimRunResult["verdict"];
  if (achievementPct >= 90) verdict = { tone: "good", quote: "Outstanding work. This is exactly the level of execution we needed. You're promoted to Senior Executive — bigger budget, more brands, harder challenges ahead." };
  else if (achievementPct >= 70) verdict = { tone: "good", quote: "Strong performance. We see real growth potential. Continuing partnership and increasing your scope next month." };
  else if (achievementPct >= 50) verdict = { tone: "warn", quote: "Mixed results. Some good decisions, but key mistakes cost us. Let's review strategy together." };
  else verdict = { tone: "bad", quote: "This campaign didn't meet expectations. We need to reconsider this partnership." };

  return { perCampaign, totals, goalRows, achievementPct, decisionScore, decisionTotal, rights, wrongs, verdict };
}
