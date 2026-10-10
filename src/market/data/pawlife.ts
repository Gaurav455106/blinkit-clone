// ── PawLife market (SPEC §3.10: state split, creative) ────────────────────────
// SKUs: paw-1 leash ₹599 (break-even 3.3), paw-2 bowl ₹499 (3.6), paw-3 harness
// ₹799 (3.3). Considered purchases: nobody impulse-buys a leash, so CVR is low
// and awareness formats matter.
// - State split: Telangana converts best; Maharashtra is big but weaker.
// - Creative: Rec Ads / Stories discovery; ToyTail enters at a festival (day 18).

import type { BrandMarket } from "@/market/types";
import { PET_ACCESSORIES } from "@/market/data/categories";
import { standardPlacements } from "@/market/data/placementTemplate";

export const PAWLIFE: BrandMarket = {
  brandId: "pawlife",
  category: PET_ACCESSORIES,
  keywords: [
    { term: "pet accessories",              tier: "head", dailyVolume: 25000, cluster: "generic", fit: { "paw-1": 0.50, "paw-2": 0.50, "paw-3": 0.50 } },
    { term: "dog products",                 tier: "head", dailyVolume: 20000, cluster: "generic", fit: { "paw-1": 0.40, "paw-2": 0.40, "paw-3": 0.40 } },
    { term: "dog leash",                    tier: "head", dailyVolume: 12000, cluster: "leash",   fit: { "paw-1": 1.20, "paw-2": 0.10, "paw-3": 0.40 } },
    { term: "dog bowl",                     tier: "head", dailyVolume: 10000, cluster: "bowl",    fit: { "paw-1": 0.10, "paw-2": 1.20, "paw-3": 0.10 } },
    { term: "dog collar",                   tier: "mid",  dailyVolume: 7000,  cluster: "leash",   fit: { "paw-1": 0.60, "paw-2": 0.10, "paw-3": 0.50 } },
    { term: "dog harness",                  tier: "mid",  dailyVolume: 6000,  cluster: "harness", fit: { "paw-1": 0.30, "paw-2": 0.10, "paw-3": 1.20 } },
    { term: "pet leash",                    tier: "mid",  dailyVolume: 5000,  cluster: "leash",   fit: { "paw-1": 1.10, "paw-2": 0.10, "paw-3": 0.30 } },
    { term: "pawlife",                      tier: "mid",  dailyVolume: 400,   cluster: "brand",   fit: { "paw-1": 1.30, "paw-2": 1.20, "paw-3": 1.20 }, isBrandTerm: true },
    { term: "retractable dog leash 5m",     tier: "long", dailyVolume: 3000,  cluster: "leash",   fit: { "paw-1": 1.30, "paw-2": 0.10, "paw-3": 0.20 } },
    { term: "stainless steel dog bowl set", tier: "long", dailyVolume: 2500,  cluster: "bowl",    fit: { "paw-1": 0.10, "paw-2": 1.30, "paw-3": 0.10 } },
    { term: "no pull dog harness medium",   tier: "long", dailyVolume: 2200,  cluster: "harness", fit: { "paw-1": 0.20, "paw-2": 0.10, "paw-3": 1.30 } },
    { term: "pawlife harness",              tier: "long", dailyVolume: 120,   cluster: "brand",   fit: { "paw-1": 0.20, "paw-2": 0.20, "paw-3": 1.30 }, isBrandTerm: true },
  ],
  placements: standardPlacements(["Pet Food & Accessories", "Dog Needs"], { "paw-1": 1.0, "paw-2": 0.9, "paw-3": 0.9 }),
  stateCVR:      { Telangana: 1.25, Karnataka: 1.00, Maharashtra: 0.85 },
  stateAffinity: { Telangana: 1.20, Karnataka: 1.10, Maharashtra: 1.20 },
  rivals: [
    {
      id: "petnest", name: "PetNest", archetype: "leader", monthlyBudget: 1000000,
      bids: { "pet accessories": 380, "dog leash": 360, "dog bowl": 340, "dog products": 350 },
      placementBids: { "category:Pet Food & Accessories": 360 },
      maxBidMult: 1.4, targetSov: 0.40, roasFloor: 2.2, lagDays: 2, relevance: 1.0, price: 649, contributionPerUnit: 200,
    },
    {
      id: "wagwear", name: "WagWear", archetype: "challenger", monthlyBudget: 1000000,
      bids: { "dog harness": 360, "dog collar": 340, "pawlife": 340, "pet leash": 330 },
      placementBids: { "stories:main-feed": 380 },
      maxBidMult: 1.5, targetSov: 0.30, roasFloor: 2.0, lagDays: 1, relevance: 0.95, price: 699, contributionPerUnit: 210,
      burst: { fromDay: 10, toDay: 16, bidMult: 1.4 },
    },
    {
      id: "toytail", name: "ToyTail", archetype: "newcomer", monthlyBudget: 300000,
      bids: { "dog bowl": 450, "dog leash": 460, "pet accessories": 480 },
      maxBidMult: 1.1, targetSov: 0.30, roasFloor: 1.5, lagDays: 2, relevance: 0.95, price: 499, contributionPerUnit: 140,
      activeFromDay: 18,
    },
  ],
  organicDailyUnits: { "paw-1": 15, "paw-2": 15, "paw-3": 6 },
  traps: ["stateSplit", "creative"],
};
