import { Scenario, Crisis } from "@/data/scenarios";

export interface CampaignChoices {
  objective: "performance" | "reach" | null;
  adFormat: string | null;
  campaignName: string;
  geography: "select_cities" | "pan_india" | null;
  skuStrategy: "hero" | "top3" | "all" | null;
  selectedSkuIds: string[];
  selectedKeywords: string[];
  budgetType: "daily" | "overall" | null;
}

export interface ScoreLine {
  key: string;
  label: string;
  earned: number;
  max: number;
  note: string;
}
export interface ScoreResult {
  total: number;
  badge: string;
  badgeEmoji: string;
  verdict: string;
  verdictTone: "good" | "warn" | "bad";
  lines: ScoreLine[];
  rights: string[];
  wrongs: string[];
}

const inventoryDecisionScore = (scen: Scenario, c: CampaignChoices): ScoreLine => {
  const inv = scen.inventory.tone;
  // Heuristic: "fix inventory first" = chose Daily Budget AND geography=select_cities when OSA low
  const triedToFix = c.budgetType === "daily" && c.geography === "select_cities";
  if (inv === "critical") {
    return triedToFix
      ? { key: "inv", label: "Inventory Decision", earned: 15, max: 15, note: "Recognized critical OSA and tightened the campaign." }
      : { key: "inv", label: "Inventory Decision", earned: 0, max: 15, note: "Critical OSA, but you pushed forward without correcting it." };
  }
  if (inv === "overstocked") {
    return c.skuStrategy === "hero" || c.skuStrategy === "top3"
      ? { key: "inv", label: "Inventory Decision", earned: 15, max: 15, note: "Trimmed SKU focus to clear aging stock." }
      : { key: "inv", label: "Inventory Decision", earned: 6, max: 15, note: "Spread too wide given overstocked SKUs." };
  }
  return { key: "inv", label: "Inventory Decision", earned: 12, max: 15, note: "Healthy inventory — reasonable plan." };
};

const objectiveScore = (scen: Scenario, c: CampaignChoices): ScoreLine =>
  c.objective === scen.profile.optimalObjective
    ? { key: "obj", label: "Campaign Objective", earned: 10, max: 10, note: `${scen.profile.optimalObjective} was the right call for this brand.` }
    : { key: "obj", label: "Campaign Objective", earned: 0, max: 10, note: `Wrong objective — ${scen.profile.optimalObjective} was the right pick.` };

const formatScore = (scen: Scenario, c: CampaignChoices): ScoreLine => {
  if (c.adFormat === scen.profile.optimalAdFormat) {
    return { key: "fmt", label: "Ad Format", earned: 15, max: 15, note: "Optimal ad format for this brand." };
  }
  const acceptable: Record<string, string[]> = {
    product_booster: ["recommendation_ads"],
    recommendation_ads: ["product_booster"],
    listing_spotlight: ["brand_booster"],
    brand_booster: ["listing_spotlight"],
  };
  if (c.adFormat && acceptable[scen.profile.optimalAdFormat]?.includes(c.adFormat)) {
    return { key: "fmt", label: "Ad Format", earned: 8, max: 15, note: "Acceptable alternative, but not optimal." };
  }
  return { key: "fmt", label: "Ad Format", earned: 5, max: 15, note: "Format mismatched for this scenario." };
};

const geographyScore = (scen: Scenario, c: CampaignChoices): ScoreLine => {
  const mustNarrow = scen.profile.id === "fuelup" || scen.inventory.osa < 70;
  if (mustNarrow) {
    return c.geography === "select_cities"
      ? { key: "geo", label: "Geography", earned: 10, max: 10, note: "Narrowed targeting where it mattered." }
      : { key: "geo", label: "Geography", earned: 0, max: 10, note: "Pan India was wrong — demand is hyperlocal or stock is patchy." };
  }
  return { key: "geo", label: "Geography", earned: 8, max: 10, note: "Acceptable geo choice." };
};

const skuScore = (c: CampaignChoices): ScoreLine => {
  if (c.skuStrategy === "hero" || c.selectedSkuIds.length === 1)
    return { key: "sku", label: "SKU Selection", earned: 10, max: 10, note: "Focused on the hero SKU." };
  if (c.skuStrategy === "top3" || c.selectedSkuIds.length <= 3)
    return { key: "sku", label: "SKU Selection", earned: 8, max: 10, note: "Top SKUs covered." };
  return { key: "sku", label: "SKU Selection", earned: 2, max: 10, note: "Spread across all SKUs dilutes spend." };
};

const targetingScore = (scen: Scenario, c: CampaignChoices): ScoreLine => {
  const good = scen.profile.goodKeywords;
  const risky = scen.profile.riskyKeywords;
  const goodHits = c.selectedKeywords.filter((k) => good.includes(k)).length;
  const riskyHits = c.selectedKeywords.filter((k) => risky.includes(k)).length;
  if (c.selectedKeywords.length === 0)
    return { key: "tgt", label: "Targeting Quality", earned: 5, max: 15, note: "No keywords picked." };
  if (riskyHits === 0 && goodHits > 0)
    return { key: "tgt", label: "Targeting Quality", earned: 15, max: 15, note: "All keywords were on-target." };
  if (goodHits > 0 && riskyHits > 0)
    return { key: "tgt", label: "Targeting Quality", earned: 8, max: 15, note: "Mixed good and risky keywords." };
  return { key: "tgt", label: "Targeting Quality", earned: 3, max: 15, note: "Mostly risky/brand-generic keywords." };
};

const budgetScore = (scen: Scenario, c: CampaignChoices): ScoreLine => {
  if (c.budgetType === "daily" && scen.inventory.tone === "healthy")
    return { key: "bud", label: "Budget Strategy", earned: 10, max: 10, note: "Daily budget matches healthy inventory." };
  if (c.budgetType === "overall" && scen.inventory.tone === "critical")
    return { key: "bud", label: "Budget Strategy", earned: 5, max: 10, note: "Overall budget with critical OSA risks dead spend." };
  return { key: "bud", label: "Budget Strategy", earned: 7, max: 10, note: "Reasonable budget setup." };
};

export function score(scen: Scenario, c: CampaignChoices, crisis: Crisis, crisisChoice: "a" | "b" | "c"): ScoreResult {
  const lines = [
    inventoryDecisionScore(scen, c),
    objectiveScore(scen, c),
    formatScore(scen, c),
    geographyScore(scen, c),
    skuScore(c),
    targetingScore(scen, c),
    budgetScore(scen, c),
  ];
  const crisisPts = crisis.options.find((o) => o.key === crisisChoice)?.points ?? 0;
  lines.push({
    key: "crs",
    label: "Crisis Response",
    earned: Math.max(0, crisisPts),
    max: 15,
    note: crisisPts >= 10 ? "Strong crisis call." : crisisPts > 0 ? "Acceptable response." : "Crisis call hurt the campaign.",
  });

  const total = lines.reduce((s, l) => s + l.earned, 0);

  let badge = "📚 Learning", badgeEmoji = "📚", verdict = "Failed 📉", verdictTone: "good" | "warn" | "bad" = "bad";
  if (total >= 90) { badge = "🏆 QCommerce Pro"; badgeEmoji = "🏆"; verdict = "Campaign Performed Well 🚀"; verdictTone = "good"; }
  else if (total >= 75) { badge = "🎯 Sharp Strategist"; badgeEmoji = "🎯"; verdict = "Campaign Performed Well 🚀"; verdictTone = "good"; }
  else if (total >= 60) { badge = "📈 Growing Fast"; badgeEmoji = "📈"; verdict = "Partially Worked ⚠️"; verdictTone = "warn"; }
  else if (total >= 40) { badge = "📚 Learning"; badgeEmoji = "📚"; verdict = "Partially Worked ⚠️"; verdictTone = "warn"; }
  else { badge = "😬 Riya Award"; badgeEmoji = "😬"; verdict = "Failed 📉"; verdictTone = "bad"; }

  const rights = lines.filter((l) => l.earned >= l.max * 0.7).map((l) => `${l.label}: ${l.note}`);
  const wrongs = lines.filter((l) => l.earned < l.max * 0.5).map((l) => `${l.label}: ${l.note}`);

  return { total, badge, badgeEmoji, verdict, verdictTone, lines, rights, wrongs };
}
