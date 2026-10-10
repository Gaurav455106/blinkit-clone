// ── Henlo market (SPEC §3.10: head vs long-tail, hero SKU) ────────────────────
// SKUs: henlo-1 jerky ₹299 (break-even 6.6), henlo-2 dental ₹249 (6.9),
// henlo-3 biscuits ₹199 (8.0). Thin margins are the brand's lesson.
// - Hero: high-volume "dog biscuits" / "puppy snacks" serve the biscuits, the
//   thinnest margin; jerky is the hero.
// - Head vs long-tail: generic head terms ("dog food", "pet accessories") are
//   crowded and low-fit; specific long-tail treat terms convert and clear cheap.
// - ChewChamp conquests the "henlo" brand terms.

import type { BrandMarket } from "@/market/types";
import { PET_TREATS } from "@/market/data/categories";
import { standardPlacements } from "@/market/data/placementTemplate";

export const HENLO: BrandMarket = {
  brandId: "henlo",
  category: PET_TREATS,
  keywords: [
    { term: "dog food",                      tier: "head", dailyVolume: 40000, cluster: "generic", fit: { "henlo-1": 0.40, "henlo-2": 0.30, "henlo-3": 0.50 } },
    { term: "dog treats",                    tier: "head", dailyVolume: 30000, cluster: "treats",  fit: { "henlo-1": 1.00, "henlo-2": 0.90, "henlo-3": 0.90 } },
    { term: "dog biscuits",                  tier: "head", dailyVolume: 26000, cluster: "biscuit", fit: { "henlo-1": 0.30, "henlo-2": 0.30, "henlo-3": 1.20 } },
    { term: "pet accessories",               tier: "head", dailyVolume: 12000, cluster: "generic", fit: { "henlo-1": 0.20, "henlo-2": 0.20, "henlo-3": 0.20 } },
    { term: "dental chews",                  tier: "mid",  dailyVolume: 9000,  cluster: "dental",  fit: { "henlo-1": 0.30, "henlo-2": 1.20, "henlo-3": 0.20 } },
    { term: "puppy snacks",                  tier: "mid",  dailyVolume: 8000,  cluster: "biscuit", fit: { "henlo-1": 0.60, "henlo-2": 0.50, "henlo-3": 1.00 } },
    { term: "chicken jerky",                 tier: "mid",  dailyVolume: 7000,  cluster: "treats",  fit: { "henlo-1": 1.25, "henlo-2": 0.20, "henlo-3": 0.20 } },
    { term: "henlo",                         tier: "mid",  dailyVolume: 1500,  cluster: "brand",   fit: { "henlo-1": 1.30, "henlo-2": 1.20, "henlo-3": 1.10 }, isBrandTerm: true },
    { term: "chicken jerky dog treats 150g", tier: "long", dailyVolume: 5000,  cluster: "treats",  fit: { "henlo-1": 1.30, "henlo-2": 0.20, "henlo-3": 0.10 } },
    { term: "grain free dog treats",         tier: "long", dailyVolume: 4500,  cluster: "treats",  fit: { "henlo-1": 1.10, "henlo-2": 0.60, "henlo-3": 0.40 } },
    { term: "dog dental sticks small breed", tier: "long", dailyVolume: 4000,  cluster: "dental",  fit: { "henlo-1": 0.20, "henlo-2": 1.25, "henlo-3": 0.10 } },
    { term: "henlo jerky",                   tier: "long", dailyVolume: 600,   cluster: "brand",   fit: { "henlo-1": 1.30, "henlo-2": 0.20, "henlo-3": 0.20 }, isBrandTerm: true },
  ],
  placements: standardPlacements(["Dog Needs", "Pet Food & Accessories"], { "henlo-1": 1.0, "henlo-2": 0.9, "henlo-3": 0.8 }),
  stateCVR:      { Karnataka: 1.10, Maharashtra: 0.95, Telangana: 1.00 },
  stateAffinity: { Karnataka: 1.20, Maharashtra: 1.10, Telangana: 1.10 },
  rivals: [
    {
      id: "barkster", name: "Barkster", archetype: "leader", monthlyBudget: 1200000,
      bids: { "dog treats": 380, "dog food": 420, "dog biscuits": 350, "dental chews": 330 },
      placementBids: { "category:Dog Needs": 380 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 4.5, lagDays: 2, relevance: 1.0, price: 349, contributionPerUnit: 60,
    },
    {
      id: "chewchamp", name: "ChewChamp", archetype: "challenger", monthlyBudget: 180000,
      bids: { "henlo": 380, "henlo jerky": 360, "dental chews": 360, "chicken jerky": 340 },
      placementBids: { "stories:feed-cat-0": 340 },
      maxBidMult: 1.6, targetSov: 0.30, roasFloor: 3.5, lagDays: 1, relevance: 0.95, price: 279, contributionPerUnit: 50,
      burst: { fromDay: 8, toDay: 14, bidMult: 1.5 },
    },
    {
      id: "pawprice", name: "PawPrice", archetype: "price_warrior", monthlyBudget: 150000,
      bids: { "dog biscuits": 260, "puppy snacks": 250, "dog treats": 240 },
      maxBidMult: 1.2, targetSov: 0.20, roasFloor: 3.0, lagDays: 3, relevance: 0.85, price: 199, contributionPerUnit: 30,
      priceCut: { day: 12, pct: 0.18 },
    },
  ],
  organicDailyUnits: { "henlo-1": 90, "henlo-2": 80, "henlo-3": 50 },
  traps: ["headLong", "hero"],
};
