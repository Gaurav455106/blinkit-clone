// ── useTour: run a section's guided tour with driver.js ──────────────────────
// Starts by itself the first time a student opens the section (once per
// student per tour), and registers itself so "Show me around" can replay it.
// Students leave any time: Skip tour, the close button, Esc or a click outside.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/components/tour/tour.css";
import { TOURS, type TourId } from "@/components/tour/tourSteps";
import { availableSteps, getOpenTour, hasSeenTour, markTourSeen, registerTour, setOpenTour, subscribeTours, targetSelector } from "@/components/tour/tourState";

/** Lets the page lay out (charts, sheets) before measuring elements. */
export const AUTO_START_DELAY_MS = 700;

let active: Driver | null = null;
let activeId: TourId | null = null;

function addSkipButton(footer: HTMLElement, onSkip: () => void): void {
  if (footer.querySelector(".sim-tour-skip")) return;
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "sim-tour-skip";
  skip.textContent = "Skip tour";
  skip.addEventListener("click", onSkip);
  footer.prepend(skip);
}

/** Starts a tour now. Returns false when none of its elements are on the page. */
export function startTour(id: TourId, email: string | null): boolean {
  const steps = availableSteps(TOURS[id].steps);
  if (steps.length === 0) return false;
  active?.destroy();
  const d = driver({
    steps: steps.map((s) => ({
      element: targetSelector(s.target),
      popover: { title: s.title, description: s.body, side: s.side ?? "bottom", align: "start" },
    })),
    showProgress: steps.length > 1,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    allowClose: true,
    allowKeyboardControl: true,
    disableActiveInteraction: true,
    smoothScroll: true,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: "sim-tour",
    onPopoverRender: (popover, opts) => {
      if (!opts.driver.isLastStep()) addSkipButton(popover.footer, () => opts.driver.destroy());
    },
    onDestroyed: () => {
      if (email) markTourSeen(email, id);
      if (active === d) { active = null; activeId = null; setOpenTour(null); }
    },
  });
  active = d;
  activeId = id;
  setOpenTour(id);
  d.drive();
  return true;
}

/** True while any guided tour is open (e.g. to pause an auto-playing clock). */
export function useTourOpen(): boolean {
  return useSyncExternalStore(subscribeTours, () => getOpenTour() !== null, () => false);
}

/**
 * Runs `id` once for this student when `ready` (wait for data, modals and
 * blocking panels first). `shown` says the tour's part of the page is on
 * screen, so "Show me around" replays it. Returns `start` for a manual replay.
 */
export function useTour(id: TourId, email: string | null | undefined, ready = true, shown = true): () => void {
  const who = email ?? null;
  const start = useCallback(() => { startTour(id, who); }, [id, who]);

  useEffect(() => (shown ? registerTour(id, start) : undefined), [id, start, shown]);

  // Leaving the page closes its tour so no overlay is left behind
  useEffect(() => () => { if (activeId === id) active?.destroy(); }, [id]);

  useEffect(() => {
    if (!ready || !shown || !who || hasSeenTour(who, id)) return;
    const t = window.setTimeout(() => {
      // Skip when another tour is already open (e.g. the wizard over the dashboard)
      if (active?.isActive()) return;
      startTour(id, who);
    }, AUTO_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [id, who, ready, shown]);

  return start;
}
