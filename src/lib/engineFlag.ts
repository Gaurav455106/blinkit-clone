// ── Which engine a brief uses ─────────────────────────────────────────────────
// Everyone plays the new simulation (v2). Every new brand brief is created on
// v2, and an older brief still in a browser is moved onto v2 (briefOnLoad).
//
// The only place v1 still shows is reviewing a past run that was played on v1:
// its results page needs the engine it was played on, so `reviewing` keeps
// the brief's own stamp.

export type EngineVersion = "v1" | "v2";

/** The engine every new brand brief is created on. */
export const NEW_BRIEF_ENGINE: EngineVersion = "v2";

export interface BriefProgress {
  hasPitch: boolean;
  hasRun: boolean;
}

/** The engine a brief was played on: its stamp, or (unstamped, older briefs) v1 once pitched or run. */
export function engineForScenario(scenario: { engine?: EngineVersion } | null, progress: BriefProgress): EngineVersion {
  if (!scenario) return NEW_BRIEF_ENGINE;
  if (scenario.engine) return scenario.engine;
  return progress.hasPitch || progress.hasRun ? "v1" : NEW_BRIEF_ENGINE;
}

/** v2 for anything being played; a past run under review keeps the engine it was played on. */
export function resolveEngine(
  scenario: { engine?: EngineVersion } | null,
  progress: BriefProgress,
  options: { reviewing?: boolean } = {},
): EngineVersion {
  return options.reviewing ? engineForScenario(scenario, progress) : NEW_BRIEF_ENGINE;
}

/**
 * What to do with the brief this browser holds (outside review):
 *   keep        already on v2
 *   stamp-v2    an older brief the student is only reading: same brief, on v2
 *   fresh-brief an older brief already pitched or running: its v1 state can't
 *               run on v2, so the student starts a new v2 brief
 */
export function briefOnLoad(scenario: { engine?: EngineVersion }, progress: BriefProgress): "keep" | "stamp-v2" | "fresh-brief" {
  if (scenario.engine === "v2") return "keep";
  return progress.hasPitch || progress.hasRun ? "fresh-brief" : "stamp-v2";
}
