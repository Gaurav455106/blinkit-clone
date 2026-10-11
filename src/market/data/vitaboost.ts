// ── VitaBoost market (SPEC §3.10: creative, head vs long-tail) ────────────────
// SKUs: vita-1 multivitamin ₹799 (break-even 4.0), vita-2 omega ₹599 (4.0),
// vita-3 iron + folic ₹499 (4.2). Category creation: few shoppers search for
// supplements on quick commerce yet, so search ads alone can't carry it.
// - Head vs long-tail: generic "vitamins" / "health supplements" are crowded
//   and low-intent; specific long-tail needs (pregnancy iron, fish oil) convert.
// - Creative: Spotlight/Stories build the category; VitaLeaf launches day 10.

import type { BrandMarket } from "@/market/types";
import { SUPPLEMENTS } from "@/market/data/categories";
import { standardPlacements } from "@/market/data/placementTemplate";

export const VITABOOST: BrandMarket = {
  brandId: "vitaboost",
  category: SUPPLEMENTS,
  keywords: [
    { term: "vitamins",                          tier: "head", dailyVolume: 30000, cluster: "generic", fit: { "vita-1": 0.80, "vita-2": 0.60, "vita-3": 0.60 } },
    { term: "health supplements",                tier: "head", dailyVolume: 20000, cluster: "generic", fit: { "vita-1": 0.80, "vita-2": 0.70, "vita-3": 0.60 } },
    { term: "multivitamin",                      tier: "head", dailyVolume: 14000, cluster: "multi",   fit: { "vita-1": 1.20, "vita-2": 0.20, "vita-3": 0.20 } },
    { term: "vitamin c tablets",                 tier: "head", dailyVolume: 12000, cluster: "multi",   fit: { "vita-1": 0.60, "vita-2": 0.20, "vita-3": 0.30 } },
    { term: "omega 3",                           tier: "mid",  dailyVolume: 7000,  cluster: "omega",   fit: { "vita-1": 0.20, "vita-2": 1.20, "vita-3": 0.10 } },
    { term: "iron tablets",                      tier: "mid",  dailyVolume: 6000,  cluster: "iron",    fit: { "vita-1": 0.10, "vita-2": 0.10, "vita-3": 1.20 } },
    { term: "folic acid",                        tier: "mid",  dailyVolume: 5000,  cluster: "iron",    fit: { "vita-1": 0.10, "vita-2": 0.10, "vita-3": 1.15 } },
    { term: "vitaboost",                         tier: "mid",  dailyVolume: 500,   cluster: "brand",   fit: { "vita-1": 1.30, "vita-2": 1.20, "vita-3": 1.20 }, isBrandTerm: true },
    { term: "multivitamin for women daily",      tier: "long", dailyVolume: 3500,  cluster: "multi",   fit: { "vita-1": 1.30, "vita-2": 0.10, "vita-3": 0.30 } },
    { term: "omega 3 fish oil capsules",         tier: "long", dailyVolume: 3000,  cluster: "omega",   fit: { "vita-1": 0.10, "vita-2": 1.30, "vita-3": 0.10 } },
    { term: "iron folic acid tablets pregnancy", tier: "long", dailyVolume: 2500,  cluster: "iron",    fit: { "vita-1": 0.10, "vita-2": 0.10, "vita-3": 1.30 } },
    { term: "vitaboost multivitamin",            tier: "long", dailyVolume: 150,   cluster: "brand",   fit: { "vita-1": 1.30, "vita-2": 0.20, "vita-3": 0.20 }, isBrandTerm: true },
  ],
  // Few people search for this yet, so browsing placements fit it better than search (SPEC §13 #33)
  placements: standardPlacements(["Health & Wellness", "Supplements"], { "vita-1": 1.35, "vita-2": 1.25, "vita-3": 1.25 }),
  stateCVR:      { Maharashtra: 1.00, Karnataka: 1.10, Telangana: 0.95 },
  stateAffinity: { Maharashtra: 1.20, Karnataka: 1.20, Telangana: 1.10 },
  rivals: [
    {
      id: "nutricore", name: "NutriCore", archetype: "leader", monthlyBudget: 1200000,
      bids: { "vitamins": 400, "multivitamin": 380, "vitamin c tablets": 360, "health supplements": 380 },
      placementBids: { "category:Health & Wellness": 380 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 2.2, lagDays: 2, relevance: 1.0, price: 699, contributionPerUnit: 220,
    },
    {
      id: "vitaleaf", name: "VitaLeaf", archetype: "newcomer", monthlyBudget: 500000,
      bids: { "multivitamin": 520, "omega 3": 480, "vitamins": 500 },
      placementBids: { "stories:main-feed": 480 },
      maxBidMult: 1.1, targetSov: 0.30, roasFloor: 1.5, lagDays: 2, relevance: 0.95, price: 649, contributionPerUnit: 180,
      activeFromDay: 10,
    },
    {
      id: "wellrx", name: "WellRx", archetype: "challenger", monthlyBudget: 30000,
      bids: { "iron tablets": 380, "folic acid": 360, "vitamin c tablets": 360 },
      maxBidMult: 1.5, targetSov: 0.30, roasFloor: 2.0, lagDays: 1, relevance: 0.95, price: 449, contributionPerUnit: 110,
      burst: { fromDay: 14, toDay: 20, bidMult: 1.4 },
    },
  ],
  organicDailyUnits: { "vita-1": 10, "vita-2": 8, "vita-3": 8 },
  traps: ["headLong", "creative"],
};
