import { Scenario, CityName } from "@/data/scenarios";
import { SavedCampaign, CmPitchResult, AbTest, ClusterReactionStored } from "@/context/SimContext";
import {
  detectArchitecture, optimalArchitecture, scoreArchitecture,
  detectSequence, scoreSequence,
  detectCannibalization, scoreCannibalization,
  scoreAbTests, scoreTokenEconomy,
} from "@/lib/phase3";
import { requiredBuckets, isAwarenessFormat, isConversionFormat } from "@/lib/scoring";

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

/**
 * Build an effective stock map that incorporates CM pitch outcomes.
 * - Strong pitch with osaBoost: approved cities get a 10% OSA lift.
 * - States with 0 stock stay at 0 regardless of CM approval (no stock = no delivery).
 * - All other states keep their raw scenario values.
 */
function buildEffectiveStockMap(
  scenario: Scenario,
  cm: CmPitchResult | null,
): Record<string, number> {
  const map: Record<string, number> = { ...scenario.cityStockMap };
  if (cm?.osaBoost && cm.approvedCities.length > 0) {
    cm.approvedCities.forEach((city) => {
      if (map[city] > 0) {
        map[city] = Math.min(100, Math.round(map[city] * 1.1));
      }
    });
  }
  return map;
}

/**
 * Given an effective stock map and the campaign's selected cities:
 * - Only cities with OSA > 0 deliver impressions (Blinkit doesn't serve ads for OOS products).
 * - avgOsa: average OSA across stocked cities only (determines conversion quality).
 * - stateScale: fraction of selected cities that actually have stock (determines impression volume).
 *
 * Example: 23 states selected, 3 stocked at 80% OSA →
 *   avgOsa = 0.80, stateScale = 3/23 = 0.13 → severely limited delivery.
 */
function effectiveDelivery(
  stockMap: Record<string, number>,
  cities: string[],
): { avgOsa: number; stateScale: number; stockedCities: string[] } {
  const stockedCities = cities.filter((c) => (stockMap[c] ?? 0) > 0);
  const avgOsa = stockedCities.length
    ? stockedCities.reduce((s, c) => s + stockMap[c], 0) / stockedCities.length / 100
    : 0;
  const stateScale = stockedCities.length / Math.max(cities.length, 1);
  return { avgOsa, stateScale, stockedCities };
}

export function simulateRun(
  scenario: Scenario,
  campaigns: SavedCampaign[],
  cm: CmPitchResult | null,
  phase3?: { abTests?: AbTest[]; cannibalResolved?: string[]; clusterReactions?: ClusterReactionStored[]; tokensSpent?: number },
): SimRunResult {
  const seasonMult = scenario.season.name === "Festival Surge" ? 1.3
    : scenario.season.name === "Post-Festival Slowdown" ? 0.7 : 1.0;
  const competitorDrag = scenario.market.name === "Aggressive Competitor" ? 0.7 : 1.0;
  const cmBonus = cm?.status === "strong" ? 1.15 : 1.0;

  // Build the post-CM-pitch effective stock map once; all campaigns share it.
  const effectiveStockMap = buildEffectiveStockMap(scenario, cm);

  const perCampaign: CampaignMetrics[] = campaigns.map((c) => {
    // Delivery is gated purely by stocked cities (OSA > 0).
    // Pan India with stock in 3/23 states → stateScale 0.13 → severely limited impressions.
    const { avgOsa, stateScale } = effectiveDelivery(effectiveStockMap, c.cities);

    const objectiveMatch = c.objective === scenario.profile.optimalObjective ? 1.3 : 0.6;
    const baseImp = (c.budget || 0) * 100;
    // Impressions scale with stateScale (how many selected states actually have stock)
    // and avgOsa (how well-stocked those states are).
    const impressions = Math.round(baseImp * stateScale * avgOsa * objectiveMatch * cmBonus * competitorDrag * seasonMult);

    const goodKws = scenario.profile.goodKeywords;
    const goodHits = c.keywords.filter((k) => goodKws.includes(k)).length;
    const riskyHits = c.keywords.length - goodHits;
    const kwQuality = c.keywords.length === 0 ? 1 : goodHits >= riskyHits ? 1.5 : 0.5;
    const formatMatch = c.adFormat === scenario.profile.optimalAdFormat ? 1.3 : 0.7;

    const ctr = 0.012 * kwQuality * formatMatch;
    const clicks = Math.round(impressions * ctr);
    // avgOsa gates conversions: low stock = shoppers hit OOS at checkout.
    const atcs = Math.round(clicks * 0.25 * avgOsa);
    const units = Math.round(atcs * 0.6);
    const spend = Math.min(c.budget || 0, Math.round((impressions / 1000) * 80 * competitorDrag));
    // Fall back to all scenario SKUs when none explicitly selected (brand_booster, listing_spotlight, stories collections)
    const skuPool = c.skuIds.length > 0 ? c.skuIds : scenario.profile.skus.map((s) => s.id);
    const avgMrp = skuPool
      .map((id) => scenario.profile.skus.find((s) => s.id === id)?.mrp ?? 0)
      .reduce((a, b) => a + b, 0) / Math.max(1, skuPool.length);
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
  // Use effectiveStockMap (post-CM) so CM-boosted cities aren't penalised.
  const noBadCities = allCities.every((c) => (effectiveStockMap[c] ?? 0) > 0);
  const skuCount = new Set(campaigns.flatMap((c) => c.skuIds)).size;
  const kwAll = campaigns.flatMap((c) => c.keywords);
  const goodKw = kwAll.filter((k) => scenario.profile.goodKeywords.includes(k)).length;
  const kwGood = kwAll.length ? goodKw / kwAll.length >= 0.6 : false;

  // ── Format bucket coverage ──────────────────────────────────────────────────
  // Check whether the student's campaign portfolio covers the bucket(s) the
  // brand's goal type requires.  A Volume-First brand needs BOTH awareness and
  // conversion campaigns; a pure ROAS-First brand only needs conversion, etc.
  const requiredBucket = requiredBuckets(scenario.profile.goalType);
  const hasAwarenessCampaign = campaigns.some((c) => isAwarenessFormat(c.adFormat));
  const hasConversionCampaign = campaigns.some((c) => isConversionFormat(c.adFormat));

  const bucketCovered =
    requiredBucket === "awareness"  ? hasAwarenessCampaign :
    requiredBucket === "conversion" ? hasConversionCampaign :
    /* both */                        hasAwarenessCampaign && hasConversionCampaign;

  // Phase 3 scoring
  const arch = detectArchitecture(campaigns);
  const archOpt = optimalArchitecture(scenario, scenario.profile.id);
  const archScore = scoreArchitecture(arch, archOpt.optimal, archOpt.alternative);
  const seq = detectSequence(campaigns);
  const seqScored = scoreSequence(scenario.profile.id, seq);
  const cannibalPairs = detectCannibalization(campaigns);
  const resolvedSet = new Set(phase3?.cannibalResolved ?? []);
  const cannibalScore = scoreCannibalization(cannibalPairs, resolvedSet);
  const abScore = scoreAbTests(phase3?.abTests ?? []);
  const tokenScore = scoreTokenEconomy(phase3?.tokensSpent ?? 0);
  const clusterScore = (phase3?.clusterReactions ?? []).length > 0 ? 5 : 2;

  // ── Budget Mix scoring ─────────────────────────────────────────────────────
  // Reads the conversion% the student set in the Brief step and compares it
  // against the recommended range for the brand's goalType.
  const storedConvPct = typeof window !== "undefined"
    ? Number(window.localStorage.getItem("sim_budget_intent_conv_pct") ?? "NaN")
    : NaN;

  const budgetMixRanges: Record<string, { min: number; max: number }> = {
    "ROAS-First":        { min: 60, max: 80 },
    "Volume-First":      { min: 50, max: 65 },
    "Awareness-First":   { min: 20, max: 40 },
    "Category-Creation": { min: 20, max: 40 },
  };
  const bmRange = budgetMixRanges[scenario.profile.goalType] ?? { min: 40, max: 60 };

  let budgetMixEarned = 4; // neutral default when no value saved
  let budgetMixLabel = "";
  if (!isNaN(storedConvPct)) {
    const deviation = storedConvPct < bmRange.min
      ? bmRange.min - storedConvPct   // under-indexed on conversion
      : storedConvPct > bmRange.max
        ? storedConvPct - bmRange.max // over-indexed on conversion
        : 0;
    if (deviation === 0) {
      budgetMixEarned = 8;
      budgetMixLabel = `Budget mix aligned (${storedConvPct}% conversion) for ${scenario.profile.goalType}`;
    } else if (deviation <= 10) {
      budgetMixEarned = 5;
      budgetMixLabel = `Budget mix slightly off — ${storedConvPct}% conversion (recommended ${bmRange.min}–${bmRange.max}% for ${scenario.profile.goalType})`;
    } else {
      budgetMixEarned = 2;
      budgetMixLabel = `Budget over-indexed — ${storedConvPct}% conversion vs recommended ${bmRange.min}–${bmRange.max}% for ${scenario.profile.goalType}`;
    }
  }

  const decisionScore = [
    { label: "Brief comprehension", earned: objMatches ? 8 : 3, max: 8 },
    { label: "CM Pitch quality", earned: Math.min(8, cm?.pitchScore ?? 0), max: 8 },
    // bucketCovered is worth up to 4 of the 10 architecture points — the rest
    // comes from archScore (city/SKU structure).  Missing a required bucket
    // halves the architecture score regardless of structural quality.
    { label: "Campaign Architecture", earned: bucketCovered ? archScore : Math.floor(archScore / 2), max: 10 },
    { label: "Launch Sequencing", earned: seqScored.score, max: 5 },
    { label: "Keyword Cannibalization", earned: Math.max(0, cannibalScore), max: 5 },
    { label: "Pin-Code Cluster Reactions", earned: clusterScore, max: 5 },
    { label: "Creative / A/B Testing", earned: abScore, max: 3 },
    { label: "Dayparting Strategy", earned: 7, max: 8 },
    { label: "Weekly Optimization", earned: 10, max: 12 },
    { label: "Event Responses", earned: 12, max: 16 },
    { label: "Stock Management", earned: noBadCities ? 7 : 3, max: 8 },
    { label: "Token Economy", earned: tokenScore, max: 5 },
    { label: "Budget Allocation", earned: kwGood ? 5 : 3, max: 5 },
    { label: "Budget Mix Strategy", earned: budgetMixEarned, max: 8 },
    { label: "Goal Achievement", earned: achievementPct >= 90 ? 2 : achievementPct >= 70 ? 1 : 0, max: 2 },
  ];
  const decisionTotal = decisionScore.reduce((s, d) => s + d.earned, 0);

  const rights: string[] = [];
  const wrongs: string[] = [];
  if (objMatches) rights.push(`Chose ${scenario.profile.optimalObjective} which matched the client's ${scenario.profile.goalType}`);
  if (cm?.status === "strong") rights.push("Strong CM pitch — premium shelf placement and OSA boost");
  if (noBadCities) rights.push("Selected only stocked cities — full budget delivered where stock exists");
  if (skuCount <= 2) rights.push("Focused SKU selection — concentrated impact");
  if (kwGood) rights.push("Mostly on-target keywords");

  if (!objMatches) wrongs.push(`Wrong objective — ${scenario.profile.optimalObjective} was the right call`);
  if (!noBadCities) wrongs.push("Included states with zero stock — Blinkit won't serve ads there, so your budget under-delivered and impression reach was limited to stocked states only");
  if (skuCount > 3) wrongs.push("Spread budget across too many SKUs — diluted impact");
  if (!kwGood && kwAll.length) wrongs.push("Selected too many risky keywords — competitive category, expensive clicks");
  if (cm?.status === "rejected" || cm?.status === "weak") wrongs.push("CM had concerns about your pitch");
  if (budgetMixLabel) {
    if (budgetMixEarned === 8) rights.push(budgetMixLabel);
    else wrongs.push(budgetMixLabel);
  }

  // Bucket coverage feedback
  if (bucketCovered) {
    if (requiredBucket === "both") {
      rights.push("Ran both awareness and conversion campaigns — covered the full funnel as the brief required");
    } else if (requiredBucket === "awareness") {
      rights.push(`Used awareness formats (listing_spotlight / brand_booster / stories) — correct for a ${scenario.profile.goalType} brand`);
    } else {
      rights.push(`Used conversion formats (product_booster / recommendation_ads) — correct for a ${scenario.profile.goalType} brand`);
    }
  } else {
    if (requiredBucket === "both") {
      if (!hasAwarenessCampaign) wrongs.push("Missing awareness campaign — this brand needs reach to feed the funnel. Add a listing_spotlight, brand_booster, or stories campaign.");
      if (!hasConversionCampaign) wrongs.push("Missing conversion campaign — awareness alone won't hit the units/ROAS target. Add a product_booster or recommendation_ads campaign.");
    } else if (requiredBucket === "awareness") {
      wrongs.push(`${scenario.profile.goalType} brand needs awareness formats (listing_spotlight, brand_booster, stories) — running only conversion campaigns burns budget on people who don't know the brand yet.`);
    } else {
      wrongs.push(`${scenario.profile.goalType} brand needs conversion formats (product_booster, recommendation_ads) — awareness campaigns won't hit ROAS or units targets.`);
    }
  }

  // Phase 3 commentary
  if (arch === archOpt.optimal) rights.push(`Picked the optimal campaign architecture (${arch}) for this brand & stock map`);
  else if (arch === "E") wrongs.push("Messy campaign architecture — no clear control over cities or SKUs");
  else if (arch !== archOpt.alternative) wrongs.push(`Architecture mismatch — used ${arch}, optimal was ${archOpt.optimal}`);
  rights.push(seqScored.note);
  if (cannibalPairs.length > 0 && resolvedSet.size < cannibalPairs.length) {
    wrongs.push(`Left ${cannibalPairs.length - resolvedSet.size} keyword overlap${cannibalPairs.length - resolvedSet.size > 1 ? "s" : ""} unresolved — paid twice for the same shoppers`);
  } else if (cannibalPairs.length > 0) {
    rights.push("Caught and resolved all keyword overlaps");
  }
  if ((phase3?.abTests ?? []).length >= 1 && (phase3?.abTests ?? []).length <= 2) rights.push("Ran disciplined A/B tests — let data pick the winning creative");
  if ((phase3?.abTests ?? []).length > 2) wrongs.push("Too many simultaneous A/B tests — diluted learnings and burned tokens");
  if ((phase3?.tokensSpent ?? 0) >= 6 && (phase3?.tokensSpent ?? 0) <= 9) rights.push("Spent decision tokens at a healthy pace");
  if ((phase3?.tokensSpent ?? 0) <= 2) wrongs.push("Hoarded decision tokens — missed optimization opportunities");

  let verdict: SimRunResult["verdict"];
  if (achievementPct >= 90) verdict = { tone: "good", quote: "Outstanding work. This is exactly the level of execution we needed. You're promoted to Senior Executive — bigger budget, more brands, harder challenges ahead." };
  else if (achievementPct >= 70) verdict = { tone: "good", quote: "Strong performance. We see real growth potential. Continuing partnership and increasing your scope next month." };
  else if (achievementPct >= 50) verdict = { tone: "warn", quote: "Mixed results. Some good decisions, but key mistakes cost us. Let's review strategy together." };
  else verdict = { tone: "bad", quote: "This campaign didn't meet expectations. We need to reconsider this partnership." };

  return { perCampaign, totals, goalRows, achievementPct, decisionScore, decisionTotal, rights, wrongs, verdict };
}
