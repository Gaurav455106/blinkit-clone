// ── Bridge: an agreed v2 deal as the v1 pitch result ─────────────────────────
// Downstream screens (sidebar unlock, wizard state badges, product list,
// relationship meter) read CmPitchResult. Filling it from the deal keeps those
// frozen platform screens working unchanged (SPEC §6.1).

import type { CmPitchResult } from "@/context/SimContext";
import type { CityName } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import { dealToRun, type OpeningDeal } from "@/market/deal";

const PITCH_MAX = 15;
const REL_MIN = 30;
const REL_SPAN = 50;

export function dealPitchResult(ctx: MarketContext, deal: OpeningDeal): CmPitchResult {
  const stock = dealToRun(ctx, deal.terms).startStock;
  const skus = ctx.scenario.profile.skus.map((s) => s.id);
  const stocked = skus.filter((id) => Object.values(stock[id] ?? {}).some((u) => u > 0));
  const states = [...new Set(Object.values(stock).flatMap((byState) => Object.entries(byState).filter(([, u]) => u > 0).map(([s]) => s)))];
  const r = deal.relationship;
  return {
    status: r >= 65 ? "strong" : r >= 50 ? "decent" : "weak",
    approvedSKUs: stocked.length ? stocked : skus,
    approvedCities: states as CityName[],
    pitchScore: Math.round(Math.max(0, Math.min(1, (r - REL_MIN) / REL_SPAN)) * PITCH_MAX),
    osaBoost: false,
    message: deal.terms.walkedAway ? "No deal: the brief's terms." : "Deal agreed with Rohit.",
    flags: deal.terms.walkedAway ? ["walked_away"] : [],
  };
}
