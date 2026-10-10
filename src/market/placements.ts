// ── Placement ids and slot layouts (SPEC §3.2.2) ──────────────────────────────
// Ids mirror what the platform wizard collects, so slice 1h can map them 1:1:
// category bids by category name, Stories feeds by the wizard's feed id
// (main-feed, feed-cat-0, feed-cat-1), Rec Ads slots by asset id.

import type { BrandProfile } from "@/data/scenarios";
import type { InventoryKind } from "@/market/types";
import { VIEW_RATES } from "@/market/auction";

/** Slots per page and how often each is seen, by inventory kind. */
export const VIEW_RATES_BY_KIND: Readonly<Record<InventoryKind, readonly number[]>> = {
  keyword: VIEW_RATES,
  category: [1, 0.55],
  recommendation: [1, 0.55],
  spotlight: [1],
  stories: [1],
};

/** Creative-led placements: the creative drives CTR and fatigue applies (SPEC §3.8). */
export const CREATIVE_KINDS: ReadonlySet<InventoryKind> = new Set(["spotlight", "stories"]);

export const SPOTLIGHT_PLACEMENTS = ["search", "home", "category"] as const;
export const REC_ADS_SLOTS = ["retargeting", "new_user", "cart", "next_product", "similar"] as const;
/** Main feed plus up to two category feeds, as in StoriesTargeting. */
export const STORIES_CATEGORY_FEEDS = 2;

export const categoryPlacementId = (category: string) => `category:${category}`;
export const spotlightPlacementId = (placement: string) => `spotlight:${placement}`;
export const storiesPlacementId = (wizardFeedId: string) => `stories:${wizardFeedId}`;
export const recPlacementId = (assetId: string) => `rec:${assetId}`;

/** Every placement a brand's wizard offers. */
export function expectedPlacementIds(profile: Pick<BrandProfile, "relevantCategories">): readonly string[] {
  const feeds = profile.relevantCategories.slice(0, STORIES_CATEGORY_FEEDS).map((_, i) => `feed-cat-${i}`);
  return [
    ...profile.relevantCategories.map(categoryPlacementId),
    ...SPOTLIGHT_PLACEMENTS.map(spotlightPlacementId),
    ...["main-feed", ...feeds].map(storiesPlacementId),
    ...REC_ADS_SLOTS.map(recPlacementId),
  ];
}
