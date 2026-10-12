// Plain lines describing a deal, for the negotiation sidebar and the done screen.

import type { MarketContext } from "@/market/engineTypes";
import { DISCOUNT_DAYS, type DealTerms } from "@/market/deal";
import { formatRupees } from "@/lib/money";

const inr = formatRupees;
const pctOf = (x: number) => `${Math.round(x * 100)}%`;

/** Plain lines describing a deal, for the sidebar and the done screen. */
export function describeDeal(ctx: MarketContext, d: DealTerms): string[] {
  if (d.walkedAway) return ["No deal: the brief's stock, no extras, no promises."];
  const names = new Map(ctx.scenario.profile.skus.map((s) => [s.id, s.name]));
  const asks = d.asks.map((a) => (a.kind === "shelfSpot" ? "You get: a better shelf spot" : a.kind === "moreStores" ? `You get: more stores in ${a.state}` : `You get: a fast restock in ${a.state}`));
  const gives = d.gives.map((g) => (g.kind === "adSpend" ? `You promise: ${inr(g.perDay * g.days)} of ads by day ${g.days}`
    : g.kind === "discount" ? `You fund: ${pctOf(g.pct)} off ${g.skuIds.map((id) => names.get(id) ?? id).join(", ")} for ${DISCOUNT_DAYS} days`
    : `You promise: ${g.osaPct}% of stores stocked in ${g.state} on day ${g.byDay}`));
  return [...asks, ...gives].length ? [...asks, ...gives] : ["No extras either way."];
}
