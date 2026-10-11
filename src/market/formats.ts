// ── Good ad formats per brand (SPEC §13 #31) ──────────────────────────────────
// One list per brand, best first. The brief's "lead with" hint and the setup
// score both read it, so what the brief recommends is what scores full marks.

import type { Scenario } from "@/data/scenarios";

export const FORMAT_NAMES: Readonly<Record<string, string>> = {
  product_booster: "Product Booster",
  recommendation_ads: "Recommendation Ads",
  listing_spotlight: "Listing Spotlight",
  brand_booster: "Brand Booster",
  stories: "Stories",
};

/** Formats that sell now; an overstocked brand needs one of these (#32). */
export const SELLING_FORMATS: readonly string[] = ["product_booster", "recommendation_ads"];

/** Formats that run on keywords in the v2 engine. */
export const KEYWORD_FORMATS: readonly string[] = ["product_booster"];

const GOOD_FORMATS: Readonly<Record<string, readonly string[]>> = {
  henlo: ["product_booster"],
  munchbox: ["product_booster"],
  fuelup: ["product_booster"],
  glow: ["listing_spotlight", "brand_booster"],
  vitaboost: ["listing_spotlight", "stories"],
  tinybuddy: ["brand_booster", "recommendation_ads"],
  pawlife: ["recommendation_ads", "brand_booster"],
};

/** The brand's good formats, best first; selling formats while stock is overstocked. */
export function goodFormatsFor(scenario: Scenario): readonly string[] {
  if (scenario.inventory.tone === "overstocked") return SELLING_FORMATS;
  return GOOD_FORMATS[scenario.profile.id] ?? [scenario.profile.optimalAdFormat];
}

const GOAL_TAIL: Readonly<Record<string, string>> = {
  "ROAS-First": "Keep every bid below what a click is worth to you.",
  "Volume-First": "Go for volume, but watch ROAS: below break-even, every extra sale loses money.",
  "Awareness-First": "These get the brand noticed; a small Product Booster catches people already searching.",
  "Category-Creation": "Few people search for this yet, so search ads alone won't work.",
};

/** The brief's campaign hint, built from the same list the setup score uses. */
export function formatHint(scenario: Scenario): string {
  const [first, second] = goodFormatsFor(scenario).map((f) => FORMAT_NAMES[f] ?? f);
  const lead = `Lead with ${first}${second ? `, then ${second}` : ""}.`;
  if (scenario.inventory.tone === "overstocked") {
    return `Clearing stock: put the money into ads that sell. ${lead} Skip awareness ads until stock is normal.`;
  }
  const tail = GOAL_TAIL[scenario.profile.goalType];
  return tail ? `${lead} ${tail}` : lead;
}
