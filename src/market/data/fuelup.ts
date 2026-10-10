// ── FuelUp market (SPEC §3.10: state split, head vs long-tail, hero SKU) ──────
// SKUs: fuel-1 whey ₹1,299 (break-even 3.25), fuel-2 plant ₹999 (3.33),
// fuel-3 bar ₹99 (6.6, deliberately thin). Starting values for calibration.
//
// Traps built into this data:
// - Hero SKU: "protein bar" is a high-volume head term that serves the ₹99 bar,
//   which can't be profitable at the ₹200 minimum CPM; whey is the hero.
// - Head vs long-tail: head terms carry most volume and the strongest rivals;
//   long-tail whey terms (~25% of profitable volume) convert better and clear
//   cheaper, but a shared budget rations them like everything else.
// - State split: Maharashtra has the most searches but converts worst and is
//   IronWhey's stronghold; Karnataka converts best.

import type { BrandMarket } from "@/market/types";
import { PROTEIN } from "@/market/data/categories";

export const FUELUP: BrandMarket = {
  brandId: "fuelup",
  category: PROTEIN,
  keywords: [
    { term: "protein powder",              tier: "head", dailyVolume: 39600, cluster: "protein-powder", fit: { "fuel-1": 1.00, "fuel-2": 0.80, "fuel-3": 0.10 } },
    { term: "protein bar",                 tier: "head", dailyVolume: 33000, cluster: "bar",            fit: { "fuel-1": 0.10, "fuel-2": 0.10, "fuel-3": 1.20 } },
    { term: "whey protein",                tier: "head", dailyVolume: 26400, cluster: "whey",           fit: { "fuel-1": 1.15, "fuel-2": 0.30, "fuel-3": 0.10 } },
    { term: "protein supplement",          tier: "head", dailyVolume: 19800,  cluster: "protein-powder", fit: { "fuel-1": 0.90, "fuel-2": 0.80, "fuel-3": 0.20 } },
    { term: "fitness supplement",          tier: "head", dailyVolume: 13200,  cluster: "generic",        fit: { "fuel-1": 0.60, "fuel-2": 0.50, "fuel-3": 0.20 } },
    { term: "gym protein",                 tier: "mid",  dailyVolume: 8800,  cluster: "protein-powder", fit: { "fuel-1": 0.70, "fuel-2": 0.50, "fuel-3": 0.40 } },
    { term: "plant protein",               tier: "mid",  dailyVolume: 7700,  cluster: "plant",          fit: { "fuel-1": 0.20, "fuel-2": 1.15, "fuel-3": 0.10 } },
    { term: "whey protein chocolate",      tier: "mid",  dailyVolume: 4800,  cluster: "whey",           fit: { "fuel-1": 1.25, "fuel-2": 0.10, "fuel-3": 0.20 } },
    { term: "fuelup",                      tier: "mid",  dailyVolume: 2000,   cluster: "brand",          fit: { "fuel-1": 1.30, "fuel-2": 1.10, "fuel-3": 1.00 }, isBrandTerm: true },
    { term: "high protein snack bar",      tier: "long", dailyVolume: 5500,   cluster: "bar",            fit: { "fuel-1": 0.05, "fuel-2": 0.05, "fuel-3": 1.25 } },
    { term: "whey protein chocolate 500g", tier: "long", dailyVolume: 8800,   cluster: "whey",           fit: { "fuel-1": 1.30, "fuel-2": 0.10, "fuel-3": 0.10 } },
    { term: "vegan protein powder vanilla",tier: "long", dailyVolume: 6600,   cluster: "plant",          fit: { "fuel-1": 0.10, "fuel-2": 1.30, "fuel-3": 0.05 } },
    { term: "whey isolate unflavoured 1kg",tier: "long", dailyVolume: 7700,  cluster: "whey",           fit: { "fuel-1": 1.20, "fuel-2": 0.10, "fuel-3": 0.05 } },
    { term: "fuelup whey",                 tier: "long", dailyVolume: 1800,   cluster: "brand",          fit: { "fuel-1": 1.30, "fuel-2": 0.30, "fuel-3": 0.20 }, isBrandTerm: true },
  ],
  // Browsing converts below search: category pages ~0.6–0.8×, Spotlight banners and Stories
  // feeds lower still; Rec Ads in cart/next-product sit near search (high intent).
  placements: [
    { id: "category:Health & Wellness", kind: "category",       label: "Health & Wellness page",   dailyVolume: 45000,  fit: { "fuel-1": 0.70, "fuel-2": 0.80, "fuel-3": 0.60 }, ctrMult: 0.60, cvrMult: 0.60 },
    { id: "category:Sports Nutrition",  kind: "category",       label: "Sports Nutrition page",    dailyVolume: 30000,  fit: { "fuel-1": 1.00, "fuel-2": 0.90, "fuel-3": 1.00 }, ctrMult: 0.80, cvrMult: 0.80 },
    { id: "spotlight:search",           kind: "spotlight",      label: "Spotlight: search results", dailyVolume: 60000, fit: { "fuel-1": 1.00, "fuel-2": 0.90, "fuel-3": 0.60 }, ctrMult: 0.60, cvrMult: 0.70 },
    { id: "spotlight:home",             kind: "spotlight",      label: "Spotlight: home",          dailyVolume: 200000, fit: { "fuel-1": 0.80, "fuel-2": 0.70, "fuel-3": 0.80 }, ctrMult: 0.25, cvrMult: 0.50 },
    { id: "spotlight:category",         kind: "spotlight",      label: "Spotlight: category pages", dailyVolume: 40000, fit: { "fuel-1": 1.00, "fuel-2": 0.90, "fuel-3": 0.80 }, ctrMult: 0.50, cvrMult: 0.70 },
    { id: "stories:main-feed",          kind: "stories",        label: "Stories: main feed",       dailyVolume: 400000, fit: { "fuel-1": 0.80, "fuel-2": 0.70, "fuel-3": 0.80 }, ctrMult: 0.35, cvrMult: 0.40 },
    { id: "stories:feed-cat-0",         kind: "stories",        label: "Stories: Health & Wellness", dailyVolume: 60000, fit: { "fuel-1": 0.90, "fuel-2": 0.90, "fuel-3": 0.70 }, ctrMult: 0.50, cvrMult: 0.50 },
    { id: "stories:feed-cat-1",         kind: "stories",        label: "Stories: Sports Nutrition", dailyVolume: 40000, fit: { "fuel-1": 1.00, "fuel-2": 0.90, "fuel-3": 0.90 }, ctrMult: 0.60, cvrMult: 0.60 },
    { id: "rec:retargeting",            kind: "recommendation", label: "Rec Ads: re-targeting",    dailyVolume: 5000,   fit: { "fuel-1": 1.10, "fuel-2": 1.00, "fuel-3": 1.00 }, ctrMult: 1.30, cvrMult: 1.40 },
    { id: "rec:new_user",               kind: "recommendation", label: "Rec Ads: new users",       dailyVolume: 15000,  fit: { "fuel-1": 0.80, "fuel-2": 0.70, "fuel-3": 0.90 }, ctrMult: 0.70, cvrMult: 0.70 },
    { id: "rec:cart",                   kind: "recommendation", label: "Rec Ads: cart",            dailyVolume: 30000,  fit: { "fuel-1": 0.80, "fuel-2": 0.70, "fuel-3": 1.10 }, ctrMult: 1.00, cvrMult: 1.00 },
    { id: "rec:next_product",           kind: "recommendation", label: "Rec Ads: next product",    dailyVolume: 25000,  fit: { "fuel-1": 1.00, "fuel-2": 0.90, "fuel-3": 0.80 }, ctrMult: 0.90, cvrMult: 1.00 },
    { id: "rec:similar",                kind: "recommendation", label: "Rec Ads: similar products", dailyVolume: 35000, fit: { "fuel-1": 1.00, "fuel-2": 0.90, "fuel-3": 0.70 }, ctrMult: 0.80, cvrMult: 0.90 },
  ],
  stateCVR:      { Karnataka: 1.20, Maharashtra: 0.85, Delhi: 1.00 },
  stateAffinity: { Karnataka: 1.30, Maharashtra: 1.10, Delhi: 1.20 },
  rivals: [
    {
      id: "ironwhey", name: "IronWhey", archetype: "leader",
      monthlyBudget: 1200000,
      bids: { "protein powder": 480, "whey protein": 420, "protein supplement": 400, "whey protein chocolate": 380, "gym protein": 360 },
      placementBids: { "category:Sports Nutrition": 450 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 2.6, lagDays: 2, relevance: 1.0,
      price: 1499, contributionPerUnit: 450,
    },
    {
      id: "wheynation", name: "WheyNation", archetype: "challenger",
      monthlyBudget: 850000,
      bids: { "whey protein": 380, "protein powder": 400, "fuelup": 420, "fuelup whey": 380, "plant protein": 300 },
      placementBids: { "stories:feed-cat-1": 380, "rec:similar": 350 },
      maxBidMult: 1.6, targetSov: 0.30, roasFloor: 2.2, lagDays: 1, relevance: 0.95,
      price: 1199, contributionPerUnit: 330,
      burst: { fromDay: 9, toDay: 15, bidMult: 1.47 },
    },
    {
      id: "profit-basics", name: "ProFit Basics", archetype: "price_warrior",
      monthlyBudget: 120000,
      bids: { "protein powder": 260, "protein bar": 300, "high protein snack bar": 240, "fitness supplement": 250 },
      placementBids: { "rec:cart": 300, "category:Health & Wellness": 260 },
      maxBidMult: 1.2, targetSov: 0.20, roasFloor: 1.8, lagDays: 3, relevance: 0.85,
      price: 899, contributionPerUnit: 200,
      priceCut: { day: 12, pct: 0.15 },
    },
  ],
  organicDailyUnits: { "fuel-1": 40, "fuel-2": 12, "fuel-3": 120 },
  traps: ["stateSplit", "headLong", "hero"],
};
