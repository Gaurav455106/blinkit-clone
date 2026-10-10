/**
 * newScoring.ts — 100-point scoring system
 *
 * Four categories, all deterministic (no Math.random):
 *
 *   SETUP            35 pts — computed immediately after campaign builder
 *   LIVE OPTIMIZATION 25 pts — accumulates during simulation
 *   CRISIS RESPONSES  25 pts — revealed at each crisis (8 + 9 + 8)
 *   RESULTS           15 pts — computed only after simulation ends
 *   ─────────────────────────
 *   TOTAL            100 pts
 *
 * Grades:
 *   90–100 → QCommerce Pro 🏆
 *   75–89  → Sharp Strategist 🎯
 *   60–74  → Growing Fast 📈
 *   40–59  → Still Learning 📚
 *   <40    → Back to Basics 😬
 */

import type { Scenario } from "@/data/scenarios";
import type { SavedCampaign } from "@/context/SimContext";
import type { RunTotals } from "@/lib/engine";
import { computeKwQuality, computeDaypartMult, getPeakBlocks } from "@/lib/engine";
import { requiredBuckets, isAwarenessFormat, isConversionFormat } from "@/lib/scoring";
import { stockedStateNames, deliverableStates, stockedCoverage } from "@/lib/geoCoverage";

// ─── Category maxes — single source for every score display ──────────────────

export const SCORE_MAX = { setup: 35, liveOpt: 25, crisis: 25, results: 15 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreLine {
  key: string;
  label: string;
  earned: number;
  max: number;
  note: string;
  good: boolean; // earned >= 70% of max
}

export interface SetupScore {
  lines: ScoreLine[];
  total: number;
  maxTotal: 35;
}

export interface LiveOptScore {
  daypartingLine: ScoreLine;
  newCampaignLine: ScoreLine;
  total: number;
  maxTotal: 25;
}

export interface CrisisScore {
  lines: ScoreLine[];  // up to 3 entries
  total: number;
  maxTotal: 25;
}

export interface ResultsScore {
  lines: ScoreLine[];
  total: number;
  maxTotal: 15;
  goalRows: { label: string; goal: number; actual: number; unit: string; pct: number }[];
  achievementPct: number;
}

export interface FinalScore {
  setup:        SetupScore;
  liveOpt:      LiveOptScore;
  crisis:       CrisisScore;
  results:      ResultsScore;
  grandTotal:   number;
  grade:        "🏆" | "🎯" | "📈" | "📚" | "😬";
  gradeLabel:   string;
  rights:       string[];
  wrongs:       string[];
}

// ─── 1. SETUP SCORE (35 pts) — shown immediately after campaign builder ───────

/**
 * Brief comprehension (20 pts):
 *   Both objective AND format correct for brand → 20
 *   Only objective correct                      → 12
 *   Only format correct (right bucket)          → 8
 *   Both wrong                                  → 0
 *
 * Geography + Targeting (15 pts):
 *   Geography (7): reaches all stocked states (Pan India counts) = 7, ≥ half = 4, some = 2, none = 0
 *   Keywords (5):  all good = 5, mixed = 3, all risky / none = 1
 *   SKU focus (3): hero or 1 SKU = 3, top 2-3 = 2, all = 0
 */
export function scoreSetup(scenario: Scenario, campaigns: SavedCampaign[]): SetupScore {
  if (campaigns.length === 0) {
    return { lines: [], total: 0, maxTotal: 35 };
  }

  const profile = scenario.profile;

  // ── Brief comprehension ───────────────────────────────────────────────────
  // Evaluate the "primary" campaign (first one, or first that matches objective).
  // Students can run multiple campaigns — we reward if ANY campaign uses correct objective + format.
  const hasCorrectObjective = campaigns.some(c => c.objective === profile.optimalObjective);
  const hasOptimalFormat    = campaigns.some(c => c.adFormat   === profile.optimalAdFormat);

  // Also check if they at least covered the required bucket
  const requiredBucket       = requiredBuckets(profile.goalType);
  const hasAwareness         = campaigns.some(c => isAwarenessFormat(c.adFormat));
  const hasConversion        = campaigns.some(c => isConversionFormat(c.adFormat));
  const bucketCovered =
    requiredBucket === "awareness"  ? hasAwareness  :
    requiredBucket === "conversion" ? hasConversion :
    hasAwareness && hasConversion;

  let comprehensionEarned: number;
  let comprehensionNote: string;

  if (hasCorrectObjective && hasOptimalFormat) {
    comprehensionEarned = 20;
    comprehensionNote   = `You chose the ${profile.optimalObjective} objective and ${profile.optimalAdFormat}. That is the right match for a ${profile.goalType} brand.`;
  } else if (hasCorrectObjective && bucketCovered) {
    comprehensionEarned = 12;
    comprehensionNote   = `Right objective (${profile.optimalObjective}) and the right type of format, but ${profile.optimalAdFormat} would have worked better.`;
  } else if (!hasCorrectObjective && hasOptimalFormat) {
    comprehensionEarned = 8;
    comprehensionNote   = `You picked the right format (${profile.optimalAdFormat}) but the wrong objective. ${profile.optimalObjective} was the right choice.`;
  } else if (!hasCorrectObjective && bucketCovered) {
    comprehensionEarned = 6;
    comprehensionNote   = `Right type of format, but the wrong objective. The best pair was ${profile.optimalObjective} with ${profile.optimalAdFormat}.`;
  } else {
    comprehensionEarned = 0;
    comprehensionNote   = `Wrong objective (it needed ${profile.optimalObjective}) and wrong format (it needed ${profile.optimalAdFormat}) for a ${profile.goalType} brand.`;
  }

  const comprehensionLine: ScoreLine = {
    key: "comprehension", label: "Brief Comprehension",
    earned: comprehensionEarned, max: 20,
    note: comprehensionNote, good: comprehensionEarned >= 14,
  };

  // ── Geography (7 pts) ─────────────────────────────────────────────────────
  // Blinkit only runs ads where stock exists, so Pan India and unstocked
  // selections cost nothing. Score how many stocked states the campaigns reach
  // together (scenario.cityStockMap is the pre-simulation OSA source).
  const stocked = stockedStateNames(scenario.cityStockMap);
  const reached = new Set(campaigns.flatMap(c => deliverableStates(c, scenario.cityStockMap)));
  const coverage = stocked.length === 0 ? 0 : reached.size / stocked.length;
  const missed = stocked.filter(s => !reached.has(s));

  let geoEarned: number;
  let geoNote: string;

  if (coverage >= 1) {
    geoEarned = 7;
    geoNote   = `Reaches all ${stocked.length} states that have stock. Ads only run where stock exists, so nothing is wasted.`;
  } else if (coverage >= 0.5) {
    geoEarned = 4;
    geoNote   = `Misses shoppers in ${missed.join(", ")}, where you have stock. Pan India would have covered them at no extra cost.`;
  } else if (coverage > 0) {
    geoEarned = 2;
    geoNote   = `Reaches only ${reached.size} of the ${stocked.length} states that have stock. Most of the shoppers you could sell to are left out.`;
  } else {
    geoEarned = 0;
    geoNote   = "None of the states you chose has stock, so the ads can't run anywhere.";
  }

  const geoLine: ScoreLine = {
    key: "geo", label: "Geography",
    earned: geoEarned, max: 7,
    note: geoNote, good: geoEarned >= 5,
  };

  // ── Keywords (5 pts) ──────────────────────────────────────────────────────
  const allKeywords = campaigns.flatMap(c => c.keywords);
  const goodKwHits  = allKeywords.filter(k => profile.goodKeywords.includes(k)).length;
  const riskyKwHits = allKeywords.length - goodKwHits;

  let kwEarned: number;
  let kwNote: string;

  if (allKeywords.length === 0) {
    kwEarned = 1;
    kwNote   = "No keywords selected, so you missed the chance to show up in searches.";
  } else if (riskyKwHits === 0) {
    kwEarned = 5;
    kwNote   = "Every keyword matches how shoppers search for the product, so the budget is well used.";
  } else if (goodKwHits > riskyKwHits) {
    kwEarned = 3;
    kwNote   = `More good keywords than risky ones (${goodKwHits} good, ${riskyKwHits} risky). OK, but you could drop the risky ones.`;
  } else {
    kwEarned = 1;
    kwNote   = `Too many risky or general keywords (${riskyKwHits} of ${allKeywords.length}). They cost a lot and rarely lead to a sale.`;
  }

  const kwLine: ScoreLine = {
    key: "keywords", label: "Keyword Quality",
    earned: kwEarned, max: 5,
    note: kwNote, good: kwEarned >= 4,
  };

  // ── SKU focus (3 pts) ─────────────────────────────────────────────────────
  const uniqueSkus  = new Set(campaigns.flatMap(c => c.skuIds)).size;
  const totalSkus   = profile.skus.length;

  let skuEarned: number;
  let skuNote: string;

  if (uniqueSkus <= 1) {
    skuEarned = 3;
    skuNote   = "Focused on one main product (hero SKU), so it gets the full budget.";
  } else if (uniqueSkus <= 2) {
    skuEarned = 3;
    skuNote   = "Only two products chosen, so each one gets enough budget.";
  } else if (uniqueSkus <= Math.ceil(totalSkus / 2)) {
    skuEarned = 2;
    skuNote   = `You chose ${uniqueSkus} products (SKUs). OK, but focusing on the main one would work better.`;
  } else {
    skuEarned = 0;
    skuNote   = `Budget spread across all ${uniqueSkus} products (SKUs), so none of them gets enough push.`;
  }

  const skuLine: ScoreLine = {
    key: "skus", label: "SKU Focus",
    earned: skuEarned, max: 3,
    note: skuNote, good: skuEarned >= 2,
  };

  const lines = [comprehensionLine, geoLine, kwLine, skuLine];
  const total = lines.reduce((s, l) => s + l.earned, 0);

  return { lines, total, maxTotal: 35 };
}

// ─── 2. LIVE OPTIMIZATION SCORE (25 pts) ─────────────────────────────────────

/**
 * Dayparting (15 pts):
 *   Good schedule (dead hours off, peaks kept) before Day 30 → 15
 *   Good schedule after Day 30                               → 8
 *   Bad schedule (peaks removed)                            → 3
 *   Never changed from 24/7                                 → 0
 *
 * New campaign launch (10 pts):
 *   Launched with remaining budget + improved geo/kw vs first → 10
 *   Launched but same mistakes                                → 5
 *   Never launched (had budget remaining)                     → 3
 *   Never launched (no budget left)                           → 3  (not penalised)
 */
export function scoreDayparting(params: {
  scenario: Scenario;
  campaigns: SavedCampaign[];
  customDayparts: Record<string, number[]>;
  daypartingChangedOnDay: Record<string, number>; // campaignId → day the change was made
}): ScoreLine {
  const { scenario, campaigns, customDayparts, daypartingChangedOnDay } = params;
  const peakBlocks = getPeakBlocks(scenario.profile.category);

  // Find the best daypart mult across all campaigns that have a custom schedule
  let bestMult = 1.0;
  let earliestChangeDay = Infinity;

  for (const campaign of campaigns) {
    const blocks = customDayparts[campaign.id];
    if (blocks && blocks.length > 0) {
      const mult = computeDaypartMult(blocks, peakBlocks);
      if (mult > bestMult) bestMult = mult;
    }
    const changeDay = daypartingChangedOnDay[campaign.id];
    if (changeDay !== undefined && changeDay < earliestChangeDay) {
      earliestChangeDay = changeDay;
    }
  }

  const changedEarly = earliestChangeDay <= 30;

  let earned: number;
  let note: string;

  if (bestMult >= 1.15 && changedEarly) {
    earned = 15;
    note   = `You found the busy hours and set your ad schedule by day ${earliestChangeDay}. This raised sales per ₹1 of ads (ROAS).`;
  } else if (bestMult >= 1.1 && changedEarly) {
    earned = 12;
    note   = `Good schedule change by day ${earliestChangeDay}. You turned off the quiet hours and kept the busy ones.`;
  } else if (bestMult >= 1.1 && !changedEarly) {
    earned = 8;
    note   = `Good schedule change, but it came late (day ${earliestChangeDay}), so you missed the early gains.`;
  } else if (bestMult >= 1.05) {
    earned = 6;
    note   = "Your schedule turned off some quiet hours, but not enough to make a big difference.";
  } else if (bestMult < 1.0) {
    earned = 3;
    note   = "Your schedule turned off busy hours, so results were worse than running all day. Check the busy hours for your category.";
  } else {
    earned = 0;
    note   = "No schedule set that beats running all day (24/7). Quiet hours (12 AM to 6 AM) used up budget and sold almost nothing.";
  }

  return {
    key: "dayparting", label: "Dayparting Optimisation",
    earned, max: 15, note, good: earned >= 10,
  };
}

export function scoreNewCampaign(params: {
  scenario: Scenario;
  originalCampaigns: SavedCampaign[];
  newCampaigns: SavedCampaign[];   // campaigns launched mid-run
  remainingBudgetAtEnd: number;
}): ScoreLine {
  const { scenario, originalCampaigns, newCampaigns, remainingBudgetAtEnd } = params;

  if (newCampaigns.length === 0) {
    // Didn't launch. Penalise only if they had meaningful budget left.
    if (remainingBudgetAtEnd > 10_000) {
      return {
        key: "newcampaign", label: "Mid-Run Campaign Launch",
        earned: 3, max: 10,
        note: `₹${Math.round(remainingBudgetAtEnd / 1000)}K was left unspent. A second campaign could have used it to get more sales.`,
        good: false,
      };
    }
    return {
      key: "newcampaign", label: "Mid-Run Campaign Launch",
      earned: 3, max: 10,
      note: "No new campaign launched during the run. Almost all the budget was already used.",
      good: false,
    };
  }

  // Evaluate if new campaigns improved on the originals: reaching more of the
  // stocked states (ads never run in unstocked ones, so those cost nothing),
  // or dropping risky keywords.
  const origCoverage = Math.max(0, ...originalCampaigns.map(c => stockedCoverage(c, scenario.cityStockMap)));
  const origRiskyKws = new Set(
    originalCampaigns
      .flatMap(c => c.keywords)
      .filter(k => !scenario.profile.goodKeywords.includes(k)),
  );

  let improved = 0;
  for (const nc of newCampaigns) {
    const newRiskyKws = nc.keywords.filter(k => origRiskyKws.has(k));
    if (stockedCoverage(nc, scenario.cityStockMap) > origCoverage || newRiskyKws.length < origRiskyKws.size) {
      improved++;
    }
  }

  if (improved > 0) {
    return {
      key: "newcampaign", label: "Mid-Run Campaign Launch",
      earned: 10, max: 10,
      note: `You launched ${newCampaigns.length} new campaign(s) during the run with better targeting, using what the data showed.`,
      good: true,
    };
  }

  return {
    key: "newcampaign", label: "Mid-Run Campaign Launch",
    earned: 5, max: 10,
    note: `You launched ${newCampaigns.length} new campaign(s) but kept the same states and keywords, so nothing improved.`,
    good: false,
  };
}

export function buildLiveOptScore(
  daypartingLine: ScoreLine,
  newCampaignLine: ScoreLine,
): LiveOptScore {
  return {
    daypartingLine,
    newCampaignLine,
    total: daypartingLine.earned + newCampaignLine.earned,
    maxTotal: 25,
  };
}

// ─── 3. CRISIS RESPONSE SCORE (25 pts: 8 + 9 + 8) ───────────────────────────

export const CRISIS_MAX: Record<1 | 2 | 3, number> = { 1: 8, 2: 9, 3: 8 };

// Default option max when a stored response predates maxScore being saved.
const DEFAULT_OPTION_MAX = 15;

/**
 * Points a stored crisis response contributed to the final score, for display
 * on trainer/admin cards. Falls back to the raw option score when the crisis
 * number is missing (legacy rows), since it can't be scaled.
 */
export function crisisCardScore(cr: {
  crisisNum?: number;
  score?: number;
  maxScore?: number;
}): { earned: number; max: number } {
  const score    = cr.score ?? 0;
  const maxScore = cr.maxScore ?? DEFAULT_OPTION_MAX;
  const num      = cr.crisisNum;
  if (num !== 1 && num !== 2 && num !== 3) {
    return { earned: score, max: maxScore };
  }
  const line = scoreCrisisResponse(num, "", score, maxScore);
  return { earned: line.earned, max: line.max };
}

export function scoreCrisisResponse(
  crisisNum: 1 | 2 | 3,
  optionKey: string,
  optionScore: number,  // score attached to the option in crisisEvents.ts
  maxOptionScore: number,
): ScoreLine {
  const max     = CRISIS_MAX[crisisNum];
  // Scale option score to this category's max
  const earned  = maxOptionScore > 0
    ? Math.round((optionScore / maxOptionScore) * max)
    : 0;
  const pct = maxOptionScore > 0 ? optionScore / maxOptionScore : 0;
  const note =
    pct >= 0.9 ? "Best possible choice. You read the situation well." :
    pct >= 0.6 ? "An OK choice, but the best option would have done better." :
    pct >= 0.3 ? "A cautious choice: little to gain, little to lose." :
                 "This choice hurt the campaign. Read the situation again to see why.";

  return {
    key: `crisis${crisisNum}`, label: `Crisis ${crisisNum} Response`,
    earned: Math.max(0, earned), max, note,
    good: earned >= Math.round(max * 0.6),
  };
}

export function buildCrisisScore(lines: ScoreLine[]): CrisisScore {
  return {
    lines,
    total: lines.reduce((s, l) => s + l.earned, 0),
    maxTotal: 25,
  };
}

// ─── 4. RESULTS SCORE (15 pts) — computed after simulation ends ──────────────

/**
 * Goal achievement (10 pts):
 *   ≥90% of all client goals met → 10
 *   ≥70%                         → 7
 *   ≥50%                         → 4
 *   <50%                         → 1
 *
 * Budget utilisation (5 pts):
 *   ≥85% of ₹2L spent           → 5
 *   ≥65%                         → 3
 *   <65%                         → 1
 */
export function scoreResults(
  scenario: Scenario,
  totals: RunTotals,
  totalSpent: number,
): ResultsScore {
  // Map goals to actuals (same labels as simResults.ts goalRows)
  const goalRows = scenario.clientGoals.metrics.map(m => {
    let actual = 0;
    switch (m.label) {
      case "ROAS":
      case "Minimum ROAS":      actual = totals.roas;          break;
      case "Units sold":
      case "Units":
      case "Reduce aging units": actual = totals.totalUnits;   break;
      case "Sell-through":       actual = totals.sellThrough;  break;
      case "Impressions":        actual = totals.totalImpressions; break;
      case "CTR":                actual = totals.ctr;          break;
      case "Branded search lift": actual = totals.brandedLift; break;
      case "Reach":              actual = totals.reach;        break;
      case "Category awareness lift": actual = Math.round(totals.brandedLift * 0.7); break;
      case "CVR":                actual = totals.cvr;          break;
      case "Repeat purchase":    actual = Math.round(Math.min(40, totals.totalUnits / 50)); break;
    }
    const pct = m.target > 0 ? Math.min(150, (actual / m.target) * 100) : 0;
    return { label: m.label, goal: m.target, actual, unit: m.unit, pct: Math.round(pct) };
  });

  const achievementPct = goalRows.length
    ? Math.round(goalRows.reduce((s, r) => s + r.pct, 0) / goalRows.length)
    : 0;

  const goalEarned =
    achievementPct >= 90 ? 10 :
    achievementPct >= 70 ? 7  :
    achievementPct >= 50 ? 4  : 1;

  const goalNote =
    achievementPct >= 90 ? `You reached ${achievementPct}% of the client's goals on average. Excellent.` :
    achievementPct >= 70 ? `You reached ${achievementPct}% of the client's goals on average. A solid run.` :
    achievementPct >= 50 ? `You reached ${achievementPct}% of the client's goals on average. Below target.` :
                           `You reached ${achievementPct}% of the client's goals on average. The campaign fell short.`;

  const scenarioBudget = scenario.budget ?? 200_000;
  const budgetPct = (totalSpent / scenarioBudget) * 100;
  const budgetEarned =
    budgetPct >= 85 ? 5 :
    budgetPct >= 65 ? 3 : 1;

  const bLabel = `₹${Math.round(scenarioBudget / 1000)}K`;
  const budgetNote =
    budgetPct >= 85 ? `You spent ₹${Math.round(totalSpent / 1000)}K of ${bLabel}. The budget was well used.` :
    budgetPct >= 65 ? `You spent ₹${Math.round(totalSpent / 1000)}K and left ₹${Math.round((scenarioBudget - totalSpent) / 1000)}K unused.` :
                      `You spent only ₹${Math.round(totalSpent / 1000)}K of ${bLabel}. A lot of budget went unused, often because of state or stock choices.`;

  const lines: ScoreLine[] = [
    { key: "goalach",  label: "Goal Achievement",   earned: goalEarned,   max: 10, note: goalNote,   good: goalEarned   >= 7 },
    { key: "budgetutil", label: "Budget Utilisation", earned: budgetEarned, max: 5,  note: budgetNote, good: budgetEarned >= 3 },
  ];

  return {
    lines,
    total: lines.reduce((s, l) => s + l.earned, 0),
    maxTotal: 15,
    goalRows,
    achievementPct,
  };
}

// ─── Final assembly ───────────────────────────────────────────────────────────

export function assembleFinalScore(
  setup:   SetupScore,
  liveOpt: LiveOptScore,
  crisis:  CrisisScore,
  results: ResultsScore,
): FinalScore {
  const grandTotal = setup.total + liveOpt.total + crisis.total + results.total;

  const grade: FinalScore["grade"] =
    grandTotal >= 90 ? "🏆" :
    grandTotal >= 75 ? "🎯" :
    grandTotal >= 60 ? "📈" :
    grandTotal >= 40 ? "📚" : "😬";

  const gradeLabel =
    grandTotal >= 90 ? "QCommerce Pro"    :
    grandTotal >= 75 ? "Sharp Strategist" :
    grandTotal >= 60 ? "Growing Fast"     :
    grandTotal >= 40 ? "Still Learning"   : "Back to Basics";

  const allLines = [
    ...setup.lines,
    liveOpt.daypartingLine,
    liveOpt.newCampaignLine,
    ...crisis.lines,
    ...results.lines,
  ];

  const rights = allLines.filter(l => l.good).map(l => `${l.label}: ${l.note}`);
  const wrongs = allLines.filter(l => !l.good && l.earned < l.max * 0.5).map(l => `${l.label}: ${l.note}`);

  return { setup, liveOpt, crisis, results, grandTotal, grade, gradeLabel, rights, wrongs };
}
