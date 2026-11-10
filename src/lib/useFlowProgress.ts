// What the student has really done, for the step trackers (see flowSteps.ts).

import { useSim } from "@/context/SimContext";
import type { FlowProgress } from "@/lib/flowSteps";

function briefAcknowledged(): boolean {
  try { return localStorage.getItem("sim_brief_ack") === "1"; } catch { return false; }
}

export function useFlowProgress(): FlowProgress {
  const { cmPitch, activeRunId, runHistory } = useSim();
  const active = activeRunId ? runHistory.find((r) => r.id === activeRunId) : undefined;
  return {
    briefDone: briefAcknowledged(),
    dealDone: cmPitch != null,
    runStarted: !!active,
    runDone: active?.status === "completed",
    anyRunCompleted: runHistory.some((r) => r.status === "completed"),
  };
}
