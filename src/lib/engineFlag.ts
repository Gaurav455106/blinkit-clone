// ── Which engine a brief uses ─────────────────────────────────────────────────
// Each brief (scenario) carries the engine it was started on, so an attempt
// never switches engines halfway. Every new brand brief starts on v2. Briefs
// created before the stamp existed stay on v1 once the student has pitched or
// started a run; one they're still reading moves to v2.
//
// Trainers can force an engine for one browser with ?engine=v1 or ?engine=v2
// (remembered); ?engine=auto goes back to the rule above.

const STORAGE_KEY = "sim_engine";

export type EngineVersion = "v1" | "v2";

/** The engine every new brand brief is created on. */
export const NEW_BRIEF_ENGINE: EngineVersion = "v2";

export interface BriefProgress {
  hasPitch: boolean;
  hasRun: boolean;
}

/** The trainer override for this browser, or null for the automatic rule. */
export function engineOverride(): EngineVersion | null {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("engine");
  try {
    if (param === "v1" || param === "v2") window.localStorage.setItem(STORAGE_KEY, param);
    if (param === "auto") window.localStorage.removeItem(STORAGE_KEY);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "v1" || stored === "v2" ? stored : null;
  } catch {
    // Storage blocked (private mode): only the URL can override
    return param === "v1" || param === "v2" ? param : null;
  }
}

/** The engine a brief belongs to, ignoring overrides. */
export function engineForScenario(scenario: { engine?: EngineVersion } | null, progress: BriefProgress): EngineVersion {
  if (!scenario) return NEW_BRIEF_ENGINE;
  if (scenario.engine) return scenario.engine;
  return progress.hasPitch || progress.hasRun ? "v1" : NEW_BRIEF_ENGINE;
}

export function resolveEngine(scenario: { engine?: EngineVersion } | null, progress: BriefProgress): EngineVersion {
  return engineOverride() ?? engineForScenario(scenario, progress);
}
