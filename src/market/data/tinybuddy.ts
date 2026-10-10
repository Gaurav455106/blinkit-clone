// ── TinyBuddy market (SPEC §3.10: state split, hero SKU) ──────────────────────
// SKUs: tiny-1 wipes ₹199 (break-even 4.0), tiny-2 rash cream ₹299 (3.3),
// tiny-3 shampoo ₹249 (3.6). Volume-first; parents shop 9 AM–12 PM.
// - Hero: "baby wipes" is the biggest term and serves wipes (lowest ₹ margin);
//   the rash cream earns most per click.
// - State split: Delhi dominates searches; Haryana converts best.

import type { BrandMarket } from "@/market/types";
import { BABY } from "@/market/data/categories";
import { standardPlacements } from "@/market/data/placementTemplate";

export const TINYBUDDY: BrandMarket = {
  brandId: "tinybuddy",
  category: BABY,
  keywords: [
    { term: "baby wipes",                    tier: "head", dailyVolume: 61200, cluster: "wipes",   fit: { "tiny-1": 1.20, "tiny-2": 0.20, "tiny-3": 0.20 } },
    { term: "baby care",                     tier: "head", dailyVolume: 42500, cluster: "generic", fit: { "tiny-1": 0.60, "tiny-2": 0.60, "tiny-3": 0.60 } },
    { term: "baby essentials",               tier: "head", dailyVolume: 25500, cluster: "generic", fit: { "tiny-1": 0.70, "tiny-2": 0.60, "tiny-3": 0.60 } },
    { term: "diaper cream",                  tier: "head", dailyVolume: 20400, cluster: "cream",   fit: { "tiny-1": 0.20, "tiny-2": 1.20, "tiny-3": 0.10 } },
    { term: "baby shampoo",                  tier: "mid",  dailyVolume: 15300,  cluster: "shampoo", fit: { "tiny-1": 0.10, "tiny-2": 0.10, "tiny-3": 1.20 } },
    { term: "rash cream",                    tier: "mid",  dailyVolume: 13600,  cluster: "cream",   fit: { "tiny-1": 0.10, "tiny-2": 1.25, "tiny-3": 0.10 } },
    { term: "parenting",                     tier: "mid",  dailyVolume: 10200,  cluster: "generic", fit: { "tiny-1": 0.20, "tiny-2": 0.20, "tiny-3": 0.20 } },
    { term: "tinybuddy",                     tier: "mid",  dailyVolume: 1200,   cluster: "brand",   fit: { "tiny-1": 1.30, "tiny-2": 1.20, "tiny-3": 1.20 }, isBrandTerm: true },
    { term: "diaper rash cream for newborn", tier: "long", dailyVolume: 6800,  cluster: "cream",   fit: { "tiny-1": 0.10, "tiny-2": 1.30, "tiny-3": 0.10 } },
    { term: "unscented baby wipes 80 pcs",   tier: "long", dailyVolume: 6000,  cluster: "wipes",   fit: { "tiny-1": 1.30, "tiny-2": 0.10, "tiny-3": 0.10 } },
    { term: "tear free baby shampoo 200ml",  tier: "long", dailyVolume: 5100,  cluster: "shampoo", fit: { "tiny-1": 0.10, "tiny-2": 0.10, "tiny-3": 1.30 } },
    { term: "tinybuddy rash cream",          tier: "long", dailyVolume: 300,   cluster: "brand",   fit: { "tiny-1": 0.20, "tiny-2": 1.30, "tiny-3": 0.20 }, isBrandTerm: true },
  ],
  placements: standardPlacements(["Baby Care", "Mother & Baby"], { "tiny-1": 1.0, "tiny-2": 0.9, "tiny-3": 0.8 }),
  stateCVR:      { Delhi: 0.85, Haryana: 1.45, "Uttar Pradesh": 1.00 },
  stateAffinity: { Delhi: 1.30, Haryana: 1.00, "Uttar Pradesh": 1.00 },
  rivals: [
    {
      id: "babysoft", name: "BabySoft", archetype: "leader", monthlyBudget: 1300000,
      bids: { "baby wipes": 420, "baby care": 400, "diaper cream": 380, "baby essentials": 380 },
      placementBids: { "category:Baby Care": 400 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 3.0, lagDays: 2, relevance: 1.0, price: 229, contributionPerUnit: 60,
    },
    {
      id: "happynest", name: "HappyNest", archetype: "challenger", monthlyBudget: 210000,
      bids: { "tinybuddy": 380, "rash cream": 380, "baby shampoo": 360, "diaper cream": 380 },
      maxBidMult: 1.5, targetSov: 0.30, roasFloor: 2.6, lagDays: 1, relevance: 0.95, price: 279, contributionPerUnit: 80,
      burst: { fromDay: 9, toDay: 15, bidMult: 1.45 },
    },
    {
      id: "budgetbub", name: "BudgetBub", archetype: "price_warrior", monthlyBudget: 150000,
      bids: { "baby wipes": 280, "baby essentials": 260 },
      maxBidMult: 1.2, targetSov: 0.20, roasFloor: 2.0, lagDays: 3, relevance: 0.85, price: 149, contributionPerUnit: 30,
      priceCut: { day: 11, pct: 0.2 },
    },
  ],
  organicDailyUnits: { "tiny-1": 120, "tiny-2": 50, "tiny-3": 30 },
  traps: ["stateSplit", "hero"],
};
