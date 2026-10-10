// ── Messages between the UI and the engine worker (SPEC §2.1) ─────────────────

import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { stepDay } from "@/market/step";

export interface StepRequest {
  id: number;
  ctx: MarketContext;
  state: MarketState;
  campaigns: readonly CampaignConfig[];
}

export type StepResponse =
  | { id: number; ok: true; state: MarketState; result: DayResult }
  | { id: number; ok: false; error: string };

/** The worker's whole job: one day per request. Pure, so it also runs on the main thread. */
export function handleStep(req: StepRequest): StepResponse {
  try {
    const { state, result } = stepDay(req.ctx, req.state, req.campaigns);
    return { id: req.id, ok: true, state, result };
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
