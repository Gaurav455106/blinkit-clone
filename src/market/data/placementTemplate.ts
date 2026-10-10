// ── Standard placements for a brand (SPEC §3.2.2) ─────────────────────────────
// Every brand's wizard offers the same placement types: its two category pages,
// three Spotlight placements, the Stories main feed plus two category feeds, and
// five Rec Ads slots. Volumes and browse multipliers are the same shape for all
// brands (scaled per brand); the brand supplies its categories and SKU fit.

import type { PlacementData } from "@/market/types";

interface Shape {
  kind: PlacementData["kind"];
  suffix: (categories: readonly string[]) => { id: string; label: string };
  dailyVolume: number;
  ctrMult: number;
  cvrMult: number;
}

const SHAPES: readonly Shape[] = [
  { kind: "category", suffix: (c) => ({ id: `category:${c[0]}`, label: `${c[0]} page` }), dailyVolume: 45000, ctrMult: 0.6, cvrMult: 0.6 },
  { kind: "category", suffix: (c) => ({ id: `category:${c[1]}`, label: `${c[1]} page` }), dailyVolume: 30000, ctrMult: 0.8, cvrMult: 0.8 },
  { kind: "spotlight", suffix: () => ({ id: "spotlight:search", label: "Spotlight: search results" }), dailyVolume: 60000, ctrMult: 0.6, cvrMult: 0.7 },
  { kind: "spotlight", suffix: () => ({ id: "spotlight:home", label: "Spotlight: home" }), dailyVolume: 200000, ctrMult: 0.25, cvrMult: 0.5 },
  { kind: "spotlight", suffix: () => ({ id: "spotlight:category", label: "Spotlight: category pages" }), dailyVolume: 40000, ctrMult: 0.5, cvrMult: 0.7 },
  { kind: "stories", suffix: () => ({ id: "stories:main-feed", label: "Stories: main feed" }), dailyVolume: 400000, ctrMult: 0.35, cvrMult: 0.4 },
  { kind: "stories", suffix: (c) => ({ id: "stories:feed-cat-0", label: `Stories: ${c[0]}` }), dailyVolume: 60000, ctrMult: 0.5, cvrMult: 0.5 },
  { kind: "stories", suffix: (c) => ({ id: "stories:feed-cat-1", label: `Stories: ${c[1]}` }), dailyVolume: 40000, ctrMult: 0.6, cvrMult: 0.6 },
  { kind: "recommendation", suffix: () => ({ id: "rec:retargeting", label: "Rec Ads: re-targeting" }), dailyVolume: 5000, ctrMult: 1.3, cvrMult: 1.4 },
  { kind: "recommendation", suffix: () => ({ id: "rec:new_user", label: "Rec Ads: new users" }), dailyVolume: 15000, ctrMult: 0.7, cvrMult: 0.7 },
  { kind: "recommendation", suffix: () => ({ id: "rec:cart", label: "Rec Ads: cart" }), dailyVolume: 30000, ctrMult: 1.0, cvrMult: 1.0 },
  { kind: "recommendation", suffix: () => ({ id: "rec:next_product", label: "Rec Ads: next product" }), dailyVolume: 25000, ctrMult: 0.9, cvrMult: 1.0 },
  { kind: "recommendation", suffix: () => ({ id: "rec:similar", label: "Rec Ads: similar products" }), dailyVolume: 35000, ctrMult: 0.8, cvrMult: 0.9 },
];

/** The 13 standard placements for a brand with two relevant categories. */
export function standardPlacements(
  categories: readonly [string, string],
  fit: Readonly<Record<string, number>>,
  volumeScale = 1,
): PlacementData[] {
  return SHAPES.map((s) => ({
    ...s.suffix(categories),
    kind: s.kind,
    dailyVolume: Math.round(s.dailyVolume * volumeScale),
    fit,
    ctrMult: s.ctrMult,
    cvrMult: s.cvrMult,
  }));
}
