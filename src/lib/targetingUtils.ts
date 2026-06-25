// ── Shared targeting utilities ────────────────────────────────────────────────
// Used by ProductBoosterTargeting and any future campaign targeting components.

export type KwType = "branded" | "generic" | "event";

/** Format a number in Indian locale (e.g. 1,23,456) */
export function inFmt(n: number) {
  return n.toLocaleString("en-IN");
}

/** Classify a keyword as branded, event-specific, or generic */
export function kwType(kw: string, brandName: string): KwType {
  const lo = kw.toLowerCase();
  const brand = brandName.toLowerCase().split(" ")[0];
  if (lo.includes(brand)) return "branded";
  const eventTerms = [
    "diwali", "holi", "christmas", "eid", "rakhi", "navratri", "dussehra",
    "pongal", "onam", "baisakhi", "ganesh chaturthi", "lohri",
    "fathers day", "father's day", "mothers day", "mother's day",
    "women's day", "new year", "valentine", "anniversary",
    "hamper", "gift hamper", "gift set", "gift basket",
  ];
  if (eventTerms.some((t) => lo.includes(t))) return "event";
  return "generic";
}

/** Deterministic (index-stable) monthly search volume for a keyword */
export function kwSearches(kw: string, idx: number, isGood: boolean): number {
  const base = isGood ? 1_100_000 : 500_000;
  return Math.max(8000, Math.round((base / (idx + 1)) * (0.8 + Math.random() * 0.4)));
}

/** Deterministic trending flag based on keyword string */
export function kwTrending(kw: string, isGood: boolean): boolean {
  return isGood ? kw.length % 3 !== 0 : kw.length % 2 === 0;
}

/**
 * Suggested exact-match bid range for a keyword, scaled to ₹1,500–₹15,000
 * based on monthly search volume.
 */
export function kwBidRange(searches: number): [number, number] {
  const ratio = Math.min(searches / 500_000, 1);
  const lo = Math.round(1500 + ratio * 11_000);
  const hi = Math.round(lo * 1.15);
  return [lo, Math.min(hi, 15_000)];
}

/** Suggested CPM bid range for a category (deterministic via char-code seed) */
export function catBidRange(cat: string): [number, number] {
  const seed = cat.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const lo = 1400 + (seed % 2400);
  return [lo, lo + Math.round(lo * 0.1 + 50)];
}

/** Simulated monthly category visits (deterministic via char-code seed) */
export function catVisits(cat: string): number {
  const seed = cat.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 60_000 + (seed % 140_000);
}

/**
 * Dynamic entry point path for a category, derived from the scenario's
 * top-level category string. Reusable by any campaign type.
 */
export function entryPoint(cat: string, scenarioCategory: string): string {
  const catLo = cat.toLowerCase();
  const scLo = scenarioCategory.toLowerCase();

  let parent: string;
  if (scLo.includes("skincare") || scLo.includes("beauty") || scLo.includes("cosmetic") || scLo.includes("fragrance") || scLo.includes("perfume"))
    parent = "beauty & cosmetics";
  else if (scLo.includes("pet") || scLo.includes("dog") || catLo.includes("pet") || catLo.includes("dog"))
    parent = "pet care";
  else if (scLo.includes("baby"))
    parent = "baby & kids";
  else if (scLo.includes("supplement") || scLo.includes("protein") || scLo.includes("fitness") || scLo.includes("health") || scLo.includes("wellness"))
    parent = "health & wellness";
  else if (scLo.includes("snack") || scLo.includes("food"))
    parent = "grocery & staples";
  else
    parent = "grocery & staples";

  return `${parent} / ${catLo}`;
}
