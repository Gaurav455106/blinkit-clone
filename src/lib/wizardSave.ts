// ── What the wizard saves with a campaign ────────────────────────────────────

/**
 * Categories the campaign targets. The targeting step shows every relevant
 * category as ticked until the student unticks it, and only writes a flag once
 * one is clicked, so a missing flag means "on".
 */
export function enabledCategories(
  relevant: readonly string[],
  enabled: Readonly<Record<string, boolean>>,
  targetingOn: boolean,
): string[] {
  if (!targetingOn) return [];
  return relevant.filter((c) => enabled[c] !== false);
}

/** The wizard's default start date. Shared so every step that reads it agrees. */
export const DEFAULT_CAMPAIGN_START = "2026-02-09";
