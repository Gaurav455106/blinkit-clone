// ── What the wizard saves with a campaign ────────────────────────────────────

/**
 * Categories the campaign targets. The targeting step shows every relevant
 * category as ticked until the student unticks it, and only writes a flag once
 * one is clicked, so a missing flag means "on".
 */
export function enabledCategories(
  relevant: readonly string[],
  enabled: Readonly<Record<string, boolean>>,
  targetingOn: boolean,
): string[] {
  if (!targetingOn) return [];
  return relevant.filter((c) => enabled[c] !== false);
}

/** The wizard's default start date. Shared so every step that reads it agrees. */
export const DEFAULT_CAMPAIGN_START = "2026-02-09";

/** The wizard values that decide which products a campaign advertises. */
export interface SkuSources {
  selectedSkus: readonly string[];
  storyVariant: "single" | "collection" | null;
  storySku: string | null;
  spotlightMode: string | null;
  spotlightProducts: readonly string[];
}

/**
 * Products the campaign advertises. Stories and Listing Spotlight pick products
 * in their own step, not the shared product step. An empty list means every SKU.
 */
export function campaignSkuIds(adAsset: string | null, src: SkuSources): string[] {
  if (adAsset === "stories") {
    return src.storyVariant === "single" && src.storySku ? [src.storySku] : [];
  }
  if (adAsset === "listing_spotlight") {
    return src.spotlightMode === "manual" ? [...src.spotlightProducts] : [];
  }
  return [...src.selectedSkus];
}
