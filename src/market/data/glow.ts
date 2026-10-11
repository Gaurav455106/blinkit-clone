// ── Glow Republic market (SPEC §3.10: state split, creative) ──────────────────
// SKUs: glow-1 serum ₹799 (break-even 4.4), glow-2 sunscreen ₹549 (4.6),
// glow-3 retinol ₹999 (4.5). Awareness-first: Spotlight and Stories carry it.
// - State split: Maharashtra has the most searches but converts worst; Delhi
//   converts best.
// - Creative: image-led placements; SkinTheory runs heavy Stories.

import type { BrandMarket } from "@/market/types";
import { SKINCARE } from "@/market/data/categories";
import { standardPlacements } from "@/market/data/placementTemplate";

export const GLOW: BrandMarket = {
  brandId: "glow",
  category: SKINCARE,
  keywords: [
    { term: "beauty",                           tier: "head", dailyVolume: 50000, cluster: "generic",   fit: { "glow-1": 0.40, "glow-2": 0.40, "glow-3": 0.40 } },
    { term: "face serum",                       tier: "head", dailyVolume: 30000, cluster: "serum",     fit: { "glow-1": 1.00, "glow-2": 0.30, "glow-3": 0.60 } },
    { term: "sunscreen spf 50",                 tier: "head", dailyVolume: 26000, cluster: "sunscreen", fit: { "glow-1": 0.20, "glow-2": 1.20, "glow-3": 0.10 } },
    { term: "skincare routine",                 tier: "head", dailyVolume: 15000, cluster: "generic",   fit: { "glow-1": 0.60, "glow-2": 0.60, "glow-3": 0.60 } },
    { term: "vitamin c serum",                  tier: "mid",  dailyVolume: 11000, cluster: "serum",     fit: { "glow-1": 1.25, "glow-2": 0.20, "glow-3": 0.30 } },
    { term: "night cream",                      tier: "mid",  dailyVolume: 9000,  cluster: "night",     fit: { "glow-1": 0.20, "glow-2": 0.10, "glow-3": 1.10 } },
    { term: "retinol cream",                    tier: "mid",  dailyVolume: 6000,  cluster: "night",     fit: { "glow-1": 0.20, "glow-2": 0.10, "glow-3": 1.25 } },
    { term: "glow republic",                    tier: "mid",  dailyVolume: 1200,  cluster: "brand",     fit: { "glow-1": 1.30, "glow-2": 1.20, "glow-3": 1.20 }, isBrandTerm: true },
    { term: "sunscreen gel spf 50 oily skin",   tier: "long", dailyVolume: 5000,  cluster: "sunscreen", fit: { "glow-1": 0.10, "glow-2": 1.30, "glow-3": 0.10 } },
    { term: "vitamin c serum for glowing skin", tier: "long", dailyVolume: 4500,  cluster: "serum",     fit: { "glow-1": 1.30, "glow-2": 0.10, "glow-3": 0.20 } },
    { term: "retinol night cream for wrinkles", tier: "long", dailyVolume: 3000,  cluster: "night",     fit: { "glow-1": 0.10, "glow-2": 0.10, "glow-3": 1.30 } },
    { term: "glow republic serum",              tier: "long", dailyVolume: 400,   cluster: "brand",     fit: { "glow-1": 1.30, "glow-2": 0.20, "glow-3": 0.40 }, isBrandTerm: true },
  ],
  placements: standardPlacements(["Beauty & Personal Care", "Skincare"], { "glow-1": 1.0, "glow-2": 0.9, "glow-3": 0.9 }),
  stateCVR:      { Maharashtra: 0.85, Delhi: 1.25, Karnataka: 1.00 },
  stateAffinity: { Maharashtra: 1.30, Delhi: 1.20, Karnataka: 1.10 },
  rivals: [
    {
      id: "dermadew", name: "DermaDew", archetype: "leader", monthlyBudget: 1400000,
      bids: { "face serum": 480, "vitamin c serum": 450, "sunscreen spf 50": 420, "night cream": 400, "beauty": 500 },
      placementBids: { "spotlight:search": 450, "category:Skincare": 420 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 2.4, lagDays: 2, relevance: 1.0, price: 899, contributionPerUnit: 300,
    },
    {
      id: "skintheory", name: "SkinTheory", archetype: "challenger", monthlyBudget: 1600000,
      bids: { "glow republic": 400, "vitamin c serum": 460, "face serum": 430 },
      placementBids: { "stories:main-feed": 450 },
      maxBidMult: 1.5, targetSov: 0.30, roasFloor: 2.2, lagDays: 1, relevance: 0.95, price: 749, contributionPerUnit: 230,
      burst: { fromDay: 10, toDay: 16, bidMult: 1.4 },
    },
    {
      id: "glowmart", name: "GlowMart Basics", archetype: "price_warrior", monthlyBudget: 200000,
      bids: { "sunscreen spf 50": 300, "beauty": 280, "skincare routine": 280 },
      maxBidMult: 1.2, targetSov: 0.20, roasFloor: 2.0, lagDays: 3, relevance: 0.85, price: 349, contributionPerUnit: 80,
      priceCut: { day: 14, pct: 0.2 },
    },
  ],
  organicDailyUnits: { "glow-1": 30, "glow-2": 40, "glow-3": 12 },
  traps: ["stateSplit", "creative"],
};
