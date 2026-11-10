// ── The student's path, one definition for every tracker ─────────────────────
// The sidebar and the page header used different names and ticked steps by
// position, so a step showed as done when it wasn't. Both read this instead.

export type FlowStepKey = "brief" | "deal" | "live" | "results";

export interface FlowStep {
  key: FlowStepKey;
  label: string;
  path: string;
}

export const FLOW_STEPS: readonly FlowStep[] = [
  { key: "brief", label: "Brief", path: "/brief" },
  { key: "deal", label: "Deal with Rohit", path: "/cm-pitch" },
  // The campaign builder lives on the live page (/campaign redirects there)
  { key: "live", label: "Campaigns and live run", path: "/simulation" },
  { key: "results", label: "Results", path: "/results" },
];

export interface FlowProgress {
  /** Brief questions answered (sim_brief_ack). */
  briefDone: boolean;
  /** Deal with Rohit agreed (cmPitch set). */
  dealDone: boolean;
  /** A run is active (started). */
  runStarted: boolean;
  /** The active run is finished and scored. */
  runDone: boolean;
  /** Any past run finished (results can be opened). */
  anyRunCompleted: boolean;
}

const PATH_STEP: Record<string, FlowStepKey> = {
  "/brief": "brief", "/cm-pitch": "deal", "/campaign": "live", "/simulation": "live", "/results": "results",
};

export function flowStepOfPath(path: string): FlowStepKey | null {
  return PATH_STEP[path] ?? null;
}

/** Done only when the student did it, never because a later page is open. */
export function stepDone(key: FlowStepKey, p: FlowProgress): boolean {
  switch (key) {
    case "brief": return p.briefDone;
    case "deal": return p.dealDone;
    case "live": return p.runDone;
    case "results": return p.runDone;
  }
}

/** Why the step can't be opened yet, or null when it can. */
export function stepLock(key: FlowStepKey, p: FlowProgress): string | null {
  switch (key) {
    case "brief": return null;
    case "deal": return p.briefDone || p.dealDone ? null : "Answer the brief questions first";
    case "live": return p.dealDone ? null : "Agree your deal with Rohit first";
    case "results":
      if (p.runDone || (!p.runStarted && p.anyRunCompleted)) return null;
      return p.runStarted ? "Results open after day 30" : "Finish a run to see results";
  }
}
