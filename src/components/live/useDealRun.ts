// The agreed opening deal as engine inputs, stable across renders (useLiveRun
// restarts the run when its deal object changes).

import { useMemo } from "react";
import { useSim, type Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import { marketContextFor } from "@/market/context";
import { dealToRun, type DealRun } from "@/market/deal";

export function useDealRun(scenario: Scenario, student: Student): DealRun | null {
  const { openingDeal } = useSim();
  return useMemo(() => {
    const ctx = openingDeal ? marketContextFor(scenario, student.batch) : null;
    return openingDeal && ctx ? dealToRun(ctx, openingDeal.terms) : null;
  }, [openingDeal, scenario, student.batch]);
}
