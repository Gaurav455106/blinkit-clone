// ── MunchBox market (SPEC §3.10: head vs long-tail, hero SKU) ─────────────────
// SKUs: munch-1 makhana ₹149 (break-even 3.3), munch-2 chips ₹49 (6.1,
// deliberately thin), munch-3 nuts ₹249 (3.6).
// - Head vs long-tail: "chips" / "snacks" / "namkeen" put you against the big
//   brands; niche long-tail terms win (the brand's v1 trap).
// - Hero: "chips" and "healthy chips" serve the ₹49 chips, which can't pay
//   for ads at the ₹200 minimum CPM.

import type { BrandMarket } from "@/market/types";
import { SNACKS } from "@/market/data/categories";
import { standardPlacements } from "@/market/data/placementTemplate";

export const MUNCHBOX: BrandMarket = {
  brandId: "munchbox",
  category: SNACKS,
  keywords: [
    { term: "chips",                              tier: "head", dailyVolume: 51000, cluster: "chips",   fit: { "munch-1": 0.10, "munch-2": 1.00, "munch-3": 0.10 } },
    { term: "snacks",                             tier: "head", dailyVolume: 59500, cluster: "generic", fit: { "munch-1": 0.60, "munch-2": 0.60, "munch-3": 0.50 } },
    { term: "namkeen",                            tier: "head", dailyVolume: 51000, cluster: "generic", fit: { "munch-1": 0.30, "munch-2": 0.50, "munch-3": 0.30 } },
    { term: "healthy chips",                      tier: "head", dailyVolume: 34000, cluster: "chips",   fit: { "munch-1": 0.40, "munch-2": 1.10, "munch-3": 0.20 } },
    { term: "makhana snacks",                     tier: "mid",  dailyVolume: 15300,  cluster: "makhana", fit: { "munch-1": 1.20, "munch-2": 0.10, "munch-3": 0.30 } },
    { term: "roasted makhana",                    tier: "mid",  dailyVolume: 13600,  cluster: "makhana", fit: { "munch-1": 1.25, "munch-2": 0.10, "munch-3": 0.20 } },
    { term: "mixed nuts",                         tier: "mid",  dailyVolume: 12800,  cluster: "nuts",    fit: { "munch-1": 0.10, "munch-2": 0.10, "munch-3": 1.20 } },
    { term: "multigrain chips",                   tier: "mid",  dailyVolume: 11900,  cluster: "chips",   fit: { "munch-1": 0.20, "munch-2": 1.20, "munch-3": 0.10 } },
    { term: "munchbox",                           tier: "mid",  dailyVolume: 1000,   cluster: "brand",   fit: { "munch-1": 1.30, "munch-2": 1.20, "munch-3": 1.20 }, isBrandTerm: true },
    { term: "peri peri makhana 60g",              tier: "long", dailyVolume: 8500,  cluster: "makhana", fit: { "munch-1": 1.30, "munch-2": 0.10, "munch-3": 0.10 } },
    { term: "low calorie snacks for weight loss", tier: "long", dailyVolume: 7600,  cluster: "makhana", fit: { "munch-1": 1.10, "munch-2": 0.40, "munch-3": 0.60 } },
    { term: "roasted mixed nuts and seeds",       tier: "long", dailyVolume: 6800,  cluster: "nuts",    fit: { "munch-1": 0.10, "munch-2": 0.10, "munch-3": 1.30 } },
    { term: "munchbox makhana",                   tier: "long", dailyVolume: 300,   cluster: "brand",   fit: { "munch-1": 1.30, "munch-2": 0.20, "munch-3": 0.20 }, isBrandTerm: true },
  ],
  placements: standardPlacements(["Snacks", "Packaged Foods"], { "munch-1": 1.0, "munch-2": 0.9, "munch-3": 0.9 }),
  stateCVR:      { Maharashtra: 1.04, Gujarat: 1.09, Karnataka: 1.04 },
  stateAffinity: { Maharashtra: 1.20, Gujarat: 1.10, Karnataka: 1.10 },
  rivals: [
    {
      id: "crunchco", name: "CrunchCo", archetype: "leader", monthlyBudget: 1500000,
      bids: { "chips": 360, "snacks": 340, "healthy chips": 320, "namkeen": 330 },
      placementBids: { "category:Snacks": 340 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 3.5, lagDays: 2, relevance: 1.0, price: 99, contributionPerUnit: 18,
    },
    {
      id: "snacksutra", name: "SnackSutra", archetype: "challenger", monthlyBudget: 250000,
      bids: { "makhana snacks": 330, "roasted makhana": 320, "healthy chips": 300 },
      maxBidMult: 1.5, targetSov: 0.30, roasFloor: 2.6, lagDays: 1, relevance: 0.95, price: 129, contributionPerUnit: 35,
      burst: { fromDay: 10, toDay: 16, bidMult: 1.5 },
    },
    {
      id: "namkeennow", name: "NamkeenNow", archetype: "price_warrior", monthlyBudget: 150000,
      bids: { "namkeen": 260, "snacks": 250, "mixed nuts": 250 },
      maxBidMult: 1.2, targetSov: 0.20, roasFloor: 2.0, lagDays: 3, relevance: 0.85, price: 199, contributionPerUnit: 45,
      priceCut: { day: 13, pct: 0.15 },
    },
  ],
  organicDailyUnits: { "munch-1": 200, "munch-2": 300, "munch-3": 80 },
  traps: ["headLong", "hero"],
};
