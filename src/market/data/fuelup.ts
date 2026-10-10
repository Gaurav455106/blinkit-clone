// ── FuelUp market (SPEC §3.10: state split, head vs long-tail, hero SKU) ──────
// SKUs: fuel-1 whey ₹1,299 (break-even 3.25), fuel-2 plant ₹999 (3.33),
// fuel-3 bar ₹99 (6.6, deliberately thin). Starting values for calibration.
//
// Traps built into this data:
// - Hero SKU: "protein bar" is a high-volume head term that serves the ₹99 bar,
//   which can't be profitable at the ₹200 minimum CPM; whey is the hero.
// - Head vs long-tail: head terms carry most volume and the strongest rivals;
//   long-tail whey terms convert better and clear cheaper.
// - State split: Maharashtra has the most searches but converts worst and is
//   IronWhey's stronghold; Karnataka converts best.

import type { BrandMarket } from "@/market/types";
import { PROTEIN } from "@/market/data/categories";

export const FUELUP: BrandMarket = {
  brandId: "fuelup",
  category: PROTEIN,
  keywords: [
    { term: "protein powder",              tier: "head", dailyVolume: 18000, cluster: "protein-powder", fit: { "fuel-1": 1.00, "fuel-2": 0.80, "fuel-3": 0.10 } },
    { term: "protein bar",                 tier: "head", dailyVolume: 15000, cluster: "bar",            fit: { "fuel-1": 0.10, "fuel-2": 0.10, "fuel-3": 1.20 } },
    { term: "whey protein",                tier: "head", dailyVolume: 12000, cluster: "whey",           fit: { "fuel-1": 1.15, "fuel-2": 0.30, "fuel-3": 0.10 } },
    { term: "protein supplement",          tier: "head", dailyVolume: 9000,  cluster: "protein-powder", fit: { "fuel-1": 0.90, "fuel-2": 0.80, "fuel-3": 0.20 } },
    { term: "fitness supplement",          tier: "head", dailyVolume: 6000,  cluster: "generic",        fit: { "fuel-1": 0.60, "fuel-2": 0.50, "fuel-3": 0.20 } },
    { term: "gym protein",                 tier: "mid",  dailyVolume: 4000,  cluster: "protein-powder", fit: { "fuel-1": 0.70, "fuel-2": 0.50, "fuel-3": 0.40 } },
    { term: "plant protein",               tier: "mid",  dailyVolume: 3500,  cluster: "plant",          fit: { "fuel-1": 0.20, "fuel-2": 1.15, "fuel-3": 0.10 } },
    { term: "whey protein chocolate",      tier: "mid",  dailyVolume: 2200,  cluster: "whey",           fit: { "fuel-1": 1.25, "fuel-2": 0.10, "fuel-3": 0.20 } },
    { term: "fuelup",                      tier: "mid",  dailyVolume: 900,   cluster: "brand",          fit: { "fuel-1": 1.30, "fuel-2": 1.10, "fuel-3": 1.00 }, isBrandTerm: true },
    { term: "high protein snack bar",      tier: "long", dailyVolume: 800,   cluster: "bar",            fit: { "fuel-1": 0.05, "fuel-2": 0.05, "fuel-3": 1.25 } },
    { term: "whey protein chocolate 500g", tier: "long", dailyVolume: 600,   cluster: "whey",           fit: { "fuel-1": 1.30, "fuel-2": 0.10, "fuel-3": 0.10 } },
    { term: "vegan protein powder vanilla",tier: "long", dailyVolume: 450,   cluster: "plant",          fit: { "fuel-1": 0.10, "fuel-2": 1.30, "fuel-3": 0.05 } },
    { term: "fuelup whey",                 tier: "long", dailyVolume: 250,   cluster: "brand",          fit: { "fuel-1": 1.30, "fuel-2": 0.30, "fuel-3": 0.20 }, isBrandTerm: true },
  ],
  stateCVR:      { Karnataka: 1.20, Maharashtra: 0.85, Delhi: 1.00 },
  stateAffinity: { Karnataka: 1.30, Maharashtra: 1.10, Delhi: 1.20 },
  rivals: [
    {
      id: "ironwhey", name: "IronWhey", archetype: "leader",
      monthlyBudget: 600000,
      bids: { "protein powder": 480, "whey protein": 420, "protein supplement": 400, "whey protein chocolate": 380, "gym protein": 360 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 2.6, lagDays: 2, relevance: 1.0,
      price: 1499, contributionPerUnit: 450,
    },
    {
      id: "wheynation", name: "WheyNation", archetype: "challenger",
      monthlyBudget: 250000,
      bids: { "whey protein": 380, "protein powder": 400, "fuelup": 420, "fuelup whey": 380, "plant protein": 300 },
      maxBidMult: 1.6, targetSov: 0.30, roasFloor: 2.2, lagDays: 1, relevance: 0.95,
      price: 1199, contributionPerUnit: 330,
      burst: { fromDay: 9, toDay: 15, bidMult: 1.47 },
    },
    {
      id: "profit-basics", name: "ProFit Basics", archetype: "price_warrior",
      monthlyBudget: 120000,
      bids: { "protein powder": 260, "protein bar": 300, "high protein snack bar": 240, "fitness supplement": 250 },
      maxBidMult: 1.2, targetSov: 0.20, roasFloor: 1.8, lagDays: 3, relevance: 0.85,
      price: 899, contributionPerUnit: 200,
      priceCut: { day: 12, pct: 0.15 },
    },
  ],
  organicDailyUnits: { "fuel-1": 40, "fuel-2": 12, "fuel-3": 120 },
};
