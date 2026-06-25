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
import { computeGeoQuality, computeKwQuality, computeDaypartMult, getPeakBlocks } from "@/lib/engine";
import { requiredBuckets, isAwarenessFormat, isConversionFormat } from "@/lib/scoring";

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
 *   Geography (7): stocked cities only = 7, pan India + bad stock = 0, acceptable = 4
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
    comprehensionNote   = `Chose ${profile.optimalObjective} objective + ${profile.optimalAdFormat} — perfect match for a ${profile.goalType} brand.`;
  } else if (hasCorrectObjective && bucketCovered) {
    comprehensionEarned = 12;
    comprehensionNote   = `Right objective (${profile.optimalObjective}), right bucket — but ${profile.optimalAdFormat} would have been stronger.`;
  } else if (!hasCorrectObjective && hasOptimalFormat) {
    comprehensionEarned = 8;
    comprehensionNote   = `Picked the right format (${profile.optimalAdFormat}) but wrong objective. ${profile.optimalObjective} was the call.`;
  } else if (!hasCorrectObjective && bucketCovered) {
    comprehensionEarned = 6;
    comprehensionNote   = `Right campaign bucket but wrong objective — ${profile.optimalObjective} + ${profile.optimalAdFormat} was the correct combo.`;
  } else {
    comprehensionEarned = 0;
    comprehensionNote   = `Wrong objective (needed ${profile.optimalObjective}) and wrong format (needed ${profile.optimalAdFormat}) for a ${profile.goalType} brand.`;
  }

  const comprehensionLine: ScoreLine = {
    key: "comprehension", label: "Brief Comprehension",
    earned: comprehensionEarned, max: 20,
    note: comprehensionNote, good: comprehensionEarned >= 14,
  };

  // ── Geography (7 pts) ─────────────────────────────────────────────────────
  // Check if student targeted states that actually have stock.
  // We use the scenario's cityStockMap as the OSA source (pre-simulation).
  const allSelectedCities = campaigns.flatMap(c => c.cities);
  const badCities = allSelectedCities.filter(city => (scenario.cityStockMap[city] ?? 0) === 0);
  const hasPanIndia = campaigns.some(c => c.geography === "pan_india");
  const stockedStateCount = Object.values(scenario.cityStockMap).filter(v => v > 0).length;

  let geoEarned: number;
  let geoNote: string;

  if (hasPanIndia && stockedStateCount <= 5) {
    geoEarned = 0;
    geoNote   = `Pan India targeting with stock in only ${stockedStateCount} states — ${23 - stockedStateCount} states had zero stock and delivered nothing.`;
  } else if (badCities.length === 0 && !hasPanIndia) {
    geoEarned = 7;
    geoNote   = "Selected only states with live stock — full budget delivers.";
  } else if (badCities.length > 0) {
    const pct = Math.round((badCities.length / allSelectedCities.length) * 100);
    geoEarned = pct > 50 ? 2 : 4;
    geoNote   = `${badCities.length} of ${allSelectedCities.length} targeted states had zero stock — ${pct}% of budget under-delivered.`;
  } else {
    geoEarned = 5;
    geoNote   = "Geo selection acceptable — a few borderline states included.";
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
    kwNote   = "No keywords selected — missed targeting opportunity.";
  } else if (riskyKwHits === 0) {
    kwEarned = 5;
    kwNote   = "All keywords on-target — competitive budget efficiency.";
  } else if (goodKwHits > riskyKwHits) {
    kwEarned = 3;
    kwNote   = `Good keywords outnumber risky (${goodKwHits} good, ${riskyKwHits} risky) — acceptable but could tighten.`;
  } else {
    kwEarned = 1;
    kwNote   = `Too many risky/generic keywords (${riskyKwHits} of ${allKeywords.length}) — expensive clicks, low conversion.`;
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
    skuNote   = "Focused on a single hero SKU — concentrated impact.";
  } else if (uniqueSkus <= 2) {
    skuEarned = 3;
    skuNote   = "Tight SKU selection — strong focus.";
  } else if (uniqueSkus <= Math.ceil(totalSkus / 2)) {
    skuEarned = 2;
    skuNote   = `Selected ${uniqueSkus} SKUs — acceptable but hero-focus would be stronger.`;
  } else {
    skuEarned = 0;
    skuNote   = `Spread across all ${uniqueSkus} SKUs — budget diluted, no SKU gets enough push.`;
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
    note   = `Identified peak hours and optimised schedule by Day ${earliestChangeDay} — strong ROAS improvement.`;
  } else if (bestMult >= 1.1 && changedEarly) {
    earned = 12;
    note   = `Good schedule change by Day ${earliestChangeDay} — removed dead hours, peaks preserved.`;
  } else if (bestMult >= 1.1 && !changedEarly) {
    earned = 8;
    note   = `Good schedule change but implemented late (Day ${earliestChangeDay}) — missed early gains.`;
  } else if (bestMult >= 1.05) {
    earned = 6;
    note   = "Partial daypart improvement — removed some dead hours but didn't fully optimise.";
  } else if (bestMult < 1.0) {
    earned = 3;
    note   = "Custom schedule removed peak hours — ROAS was worse than 24/7. Check peak blocks for your brand category.";
  } else {
    earned = 0;
    note   = "Ran all campaigns on 24/7 — dead hours (12–6 AM) burned budget with near-zero returns.";
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
        note: `₹${Math.round(remainingBudgetAtEnd / 1000)}K left unspent — launching a follow-up campaign could have driven more results.`,
        good: false,
      };
    }
    return {
      key: "newcampaign", label: "Mid-Run Campaign Launch",
      earned: 3, max: 10,
      note: "Budget fully utilised — no remaining budget for a new campaign.",
      good: false,
    };
  }

  // Evaluate if new campaigns improved on the originals
  const origBadCities = new Set(
    originalCampaigns
      .flatMap(c => c.cities)
      .filter(city => (scenario.cityStockMap[city] ?? 0) === 0),
  );
  const origRiskyKws = new Set(
    originalCampaigns
      .flatMap(c => c.keywords)
      .filter(k => !scenario.profile.goodKeywords.includes(k)),
  );

  let improved = 0;
  for (const nc of newCampaigns) {
    const newBadCities = nc.cities.filter(city => origBadCities.has(city));
    const newRiskyKws  = nc.keywords.filter(k => origRiskyKws.has(k));
    if (newBadCities.length < Math.max(1, origBadCities.size) || newRiskyKws.length < origRiskyKws.size) {
      improved++;
    }
  }

  if (improved > 0) {
    return {
      key: "newcampaign", label: "Mid-Run Campaign Launch",
      earned: 10, max: 10,
      note: `Launched ${newCampaigns.length} new campaign(s) mid-run with improved targeting — applied learnings from the data.`,
      good: true,
    };
  }

  return {
    key: "newcampaign", label: "Mid-Run Campaign Launch",
    earned: 5, max: 10,
    note: `Launched ${newCampaigns.length} new campaign(s) but repeated the same geo/keyword choices — missed the chance to improve.`,
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

const CRISIS_MAX: Record<1 | 2 | 3, number> = { 1: 8, 2: 9, 3: 8 };

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
    pct >= 0.9 ? "Best possible response — strong strategic read." :
    pct >= 0.6 ? "Acceptable call but the optimal response would have done better." :
    pct >= 0.3 ? "Cautious choice — low upside, low downside." :
                 "This decision hurt the campaign — review the scenario reasoning.";

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
    achievementPct >= 90 ? `${achievementPct}% of client goals met — outstanding.` :
    achievementPct >= 70 ? `${achievementPct}% of client goals met — solid run.` :
    achievementPct >= 50 ? `${achievementPct}% of client goals met — below target.` :
                           `${achievementPct}% of client goals met — campaign fell short.`;

  const scenarioBudget = scenario.budget ?? 200_000;
  const budgetPct = (totalSpent / scenarioBudget) * 100;
  const budgetEarned =
    budgetPct >= 85 ? 5 :
    budgetPct >= 65 ? 3 : 1;

  const bLabel = `₹${Math.round(scenarioBudget / 1000)}K`;
  const budgetNote =
    budgetPct >= 85 ? `₹${Math.round(totalSpent / 1000)}K of ${bLabel} deployed — budget well utilised.` :
    budgetPct >= 65 ? `₹${Math.round(totalSpent / 1000)}K spent — left ₹${Math.round((scenarioBudget - totalSpent) / 1000)}K undeployed.` :
                      `Only ₹${Math.round(totalSpent / 1000)}K of ${bLabel} spent — significant budget wasted due to geo or stock issues.`;

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
