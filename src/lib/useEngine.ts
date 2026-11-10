// React hook: is the current brief on the v2 engine? (see engineFlag.ts)

import { useSim } from "@/context/SimContext";
import { resolveEngine } from "@/lib/engineFlag";

export function useIsEngineV2(): boolean {
  const { scenario, cmPitch, openingDeal, activeRunId, reviewRunId } = useSim();
  // Everyone plays v2; only a past run under review keeps the engine it was played on
  return resolveEngine(scenario, { hasPitch: !!cmPitch || !!openingDeal, hasRun: !!activeRunId }, { reviewing: !!reviewRunId }) === "v2";
}
