// ── Motion helpers (SPEC §15) ─────────────────────────────────────────────────

/** True when the viewer asked the system for less motion (or the check isn't possible). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/** Ease-out cubic: fast start, gentle landing. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
