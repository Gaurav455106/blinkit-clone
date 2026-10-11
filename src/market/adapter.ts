// ── SavedCampaign (wizard) → CampaignConfig (engine) ──────────────────────────
// Bids live in the campaign's wizardSnapshot (the wizard's localStorage keys at
// save time). Older saves have no bids; they get the suggested low bid so a
// campaign still runs. Listing Spotlight has no bid in the wizard, so it bids
// automatically at the middle of the suggested range (open question Q27).

import type { SavedCampaign } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import type { CampaignConfig, KeywordBid, PlacementBid } from "@/market/engineTypes";
import { keywordRange, categoryRange, recSlotRange } from "@/market/wizardData";
import { marketContextFor } from "@/market/context";
import { suggestPlacementRange } from "@/market/suggest";
import { categoryPlacementId, recPlacementId, spotlightPlacementId, storiesPlacementId, SPOTLIGHT_PLACEMENTS } from "@/market/placements";

/** Base CPMs the Stories screen shows (StoriesTargeting): main feed and category feeds. */
const STORIES_BASE_CPM: Readonly<Record<string, number>> = { "main-feed": 500 };
const STORIES_CATEGORY_FEED_CPM = 625;

function readJson<T>(snapshot: Record<string, string> | undefined, key: string, fallback: T): T {
  const raw = snapshot?.[key];
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const toNumber = (v: string | number | undefined): number | undefined => {
  const n = typeof v === "number" ? v : v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function keywordBids(c: SavedCampaign, scenario: Scenario, batch: string): KeywordBid[] {
  const snap = c.wizardSnapshot;
  const exact = readJson<Record<string, string>>(snap, "sim_keyword_exact_bids", {});
  const smart = readJson<Record<string, string>>(snap, "sim_keyword_smart_bids", {});
  const smartOn = readJson<Record<string, boolean>>(snap, "sim_keyword_smart_enabled", {});
  return c.keywords.map((term) => {
    const smartBid = smartOn[term] ? toNumber(smart[term]) : undefined;
    return {
      term,
      exactBid: toNumber(exact[term]) ?? keywordRange(scenario, batch, term).lo,
      ...(smartBid !== undefined ? { smartBid } : {}),
    };
  });
}

/** Largest boost the student ticked, as a fraction (decision #23: always applied). */
function boostPct(c: SavedCampaign): number | undefined {
  const on = readJson<Record<string, boolean>>(c.wizardSnapshot, "sim_keyword_boost", {});
  const pct = readJson<Record<string, string>>(c.wizardSnapshot, "sim_keyword_boost_pct", {});
  const values = Object.keys(on).filter((k) => on[k]).map((k) => toNumber(pct[k]) ?? 0);
  const max = values.length ? Math.max(...values) : 0;
  return max > 0 ? max / 100 : undefined;
}

function placementBids(c: SavedCampaign, scenario: Scenario, batch: string): PlacementBid[] {
  const snap = c.wizardSnapshot;
  switch (c.adFormat) {
    case "product_booster":
    case "brand_booster": {
      const bids = readJson<Record<string, string>>(snap, "sim_cat_bids", {});
      return (c.categories ?? []).map((cat) => ({
        id: categoryPlacementId(cat),
        bid: toNumber(bids[cat]) ?? categoryRange(scenario, batch, cat).lo,
      }));
    }
    case "stories": {
      const overrides = readJson<Record<string, string>>(snap, "sim_cpm_overrides", {});
      return (c.feeds ?? []).map((feed) => ({
        id: storiesPlacementId(feed),
        bid: toNumber(overrides[feed]) ?? STORIES_BASE_CPM[feed] ?? STORIES_CATEGORY_FEED_CPM,
      }));
    }
    case "recommendation_ads": {
      const checked = readJson<Record<string, boolean>>(snap, "sim_rec_checked", {});
      const bids = readJson<Record<string, string>>(snap, "sim_rec_bids", {});
      return Object.keys(checked).filter((id) => checked[id]).map((id) => ({
        id: recPlacementId(id),
        bid: toNumber(bids[id]) ?? recSlotRange(scenario, batch, id).lo,
      }));
    }
    case "listing_spotlight": {
      const ctx = marketContextFor(scenario, batch);
      return SPOTLIGHT_PLACEMENTS.map((p) => {
        const id = spotlightPlacementId(p);
        const range = ctx ? suggestPlacementRange(ctx, id) : { lo: 200, hi: 400 };
        return { id, bid: Math.round((range.lo + range.hi) / 2) };
      });
    }
    default:
      return [];
  }
}

const KEYWORD_FORMATS = new Set(["product_booster", "recommendation_ads"]);

export function savedCampaignToConfig(c: SavedCampaign, scenario: Scenario, batch: string): CampaignConfig {
  const placements = placementBids(c, scenario, batch);
  return {
    id: c.id,
    skuIds: c.skuIds.length > 0 ? c.skuIds : scenario.profile.skus.map((s) => s.id),
    keywords: KEYWORD_FORMATS.has(c.adFormat ?? "") ? keywordBids(c, scenario, batch) : [],
    ...(placements.length ? { placements } : {}),
    ...(boostPct(c) !== undefined ? { boostPct: boostPct(c) } : {}),
    geography: c.geography,
    cities: c.cities,
    budgetType: c.budgetType === "overall" ? "overall" : "daily",
    budget: c.budget,
    launchDay: c.launchDay ?? 1,
    ...(c.endDay !== undefined ? { endDay: c.endDay } : {}),
    ...(c.dayparting && c.dayparting.length > 0 ? { schedule: c.dayparting } : {}),
  };
}
