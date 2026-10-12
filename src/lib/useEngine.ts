// React hook: is the current brief on the v2 engine? (see engineFlag.ts)

import { useSim } from "@/context/SimContext";
import { resolveEngine } from "@/lib/engineFlag";

export function useIsEngineV2(): boolean {
  const { scenario, cmPitch, openingDeal, activeRunId } = useSim();
  return resolveEngine(scenario, { hasPitch: !!cmPitch || !!openingDeal, hasRun: !!activeRunId }) === "v2";
}
