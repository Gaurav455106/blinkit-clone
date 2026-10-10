// ── The student's entries for one results page (SPEC §14 F2a, F2e, F2f, F16) ──
// For a keyword × state, each live campaign enters at most once: exact match if
// it targets the keyword, otherwise smart match through a same-cluster keyword.
// It shows its best-fitting SKU that's in stock there (F16).

import type { Scenario } from "@/data/scenarios";
import type { CampaignConfig, MarketState } from "@/market/engineTypes";
import type { BrandMarket, KeywordData } from "@/market/types";
import { relevance, type CtrHistory } from "@/market/relevance";
import { osa } from "@/market/stock";
import { CITY_STORE_COUNT } from "@/data/scenarios";

/** Smart match reaches related searches with lower fit (F2e). */
export const SMART_FIT_MULT = 0.85;

export interface StudentEntry {
  campaignId: string;
  matchType: "exact" | "smart";
  skuId: string;
  /** Effective bid after boost (₹ CPM). */
  bid: number;
  relevance: number;
  /** Fit used for CVR (smart match already reduced). */
  fit: number;
  /** Share of this state's searches where the SKU is in stock. */
  osa: number;
}

export function ctrHistoryFor(state: MarketState, term: string, skuId: string): CtrHistory | undefined {
  const w = state.ctrWindow[`${term}|${skuId}`];
  if (!w) return undefined;
  return {
    clicks: w.clicks.reduce((s, x) => s + x, 0),
    viewableImpressions: w.viewable.reduce((s, x) => s + x, 0),
  };
}

export function campaignTargetsState(c: CampaignConfig, stateName: string): boolean {
  if (c.geography === "pan_india" || c.cities.length === 0) return true;
  return c.cities.includes(stateName);
}

interface SkuChoice { skuId: string; fit: number; osa: number }

/** Best-fitting SKU in stock; if none is in stock, the best fit with OSA 0 (shows as lost to stock). */
function pickSku(
  c: CampaignConfig,
  keyword: KeywordData,
  stateName: string,
  scenario: Scenario,
  state: MarketState,
): SkuChoice | null {
  const stores = CITY_STORE_COUNT[stateName as keyof typeof CITY_STORE_COUNT] ?? 0;
  const options = c.skuIds
    .map((id) => {
      const sku = scenario.profile.skus.find((s) => s.id === id);
      if (!sku) return null;
      const units = state.stock[id]?.[stateName] ?? 0;
      return { skuId: id, fit: keyword.fit[id] ?? 0, osa: osa(units, stores, sku.velocity) };
    })
    .filter((o): o is SkuChoice => o !== null && o.fit > 0);
  if (options.length === 0) return null;
  const inStock = options.filter((o) => o.osa > 0);
  const pool = inStock.length > 0 ? inStock : options;
  return pool.reduce((best, o) => (o.fit > best.fit || (o.fit === best.fit && o.skuId < best.skuId) ? o : best));
}

export function studentEntries(
  campaigns: readonly CampaignConfig[],
  keyword: KeywordData,
  stateName: string,
  market: BrandMarket,
  scenario: Scenario,
  state: MarketState,
): StudentEntry[] {
  const entries: StudentEntry[] = [];
  for (const c of campaigns) {
    if (!campaignTargetsState(c, stateName)) continue;
    const exact = c.keywords.find((k) => k.term === keyword.term);
    const smartVia = exact ? undefined : c.keywords.find((k) =>
      k.smartBid !== undefined && market.keywords.find((m) => m.term === k.term)?.cluster === keyword.cluster);
    const source = exact ?? smartVia;
    if (!source) continue;
    const choice = pickSku(c, keyword, stateName, scenario, state);
    if (!choice) continue;
    const matchType = exact ? "exact" : "smart";
    const fit = matchType === "exact" ? choice.fit : choice.fit * SMART_FIT_MULT;
    const rawBid = matchType === "exact" ? source.exactBid : source.smartBid!;
    entries.push({
      campaignId: c.id,
      matchType,
      skuId: choice.skuId,
      bid: rawBid * (1 + (c.boostPct ?? 0)),
      relevance: relevance(fit, ctrHistoryFor(state, keyword.term, choice.skuId), market.category.baseCTR),
      fit,
      osa: choice.osa,
    });
  }
  return entries;
}
