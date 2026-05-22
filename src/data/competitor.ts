export const COMPETITOR_NAMES = ["Tezzy", "KwikMart", "Speedee", "Boltz", "Rapidly"] as const;
export type Aggressiveness = "low" | "medium" | "high";

export interface Competitor {
  name: string;
  aggressiveness: Aggressiveness;
  budget: number;
}

export interface CompetitorAction {
  week: number;
  type: "kw_bid" | "city_attack" | "zone_attack" | "price_cut";
  description: string;
  impact: { cpcMult?: number; impShareMult?: number; ctrMult?: number; cvrMult?: number };
}

export function initCompetitor(marketAggressive: boolean): Competitor {
  const name = COMPETITOR_NAMES[Math.floor(Math.random() * COMPETITOR_NAMES.length)];
  const aggressiveness: Aggressiveness = marketAggressive ? "high" : (["low", "medium", "high"] as const)[Math.floor(Math.random() * 3)];
  return { name, aggressiveness, budget: marketAggressive ? 300000 : 200000 };
}
