// ── Tour state: who has seen which tour, and which steps are on the page ─────

import type { TourId, TourStep } from "@/components/tour/tourSteps";

const PREFIX = "sim_tour_seen";
const norm = (email: string) => email.trim().toLowerCase();

export const tourSeenKey = (email: string, id: TourId) => `${PREFIX}:${norm(email)}:${id}`;

export function hasSeenTour(email: string, id: TourId): boolean {
  try {
    return localStorage.getItem(tourSeenKey(email, id)) === "1";
  } catch {
    return true; // Storage blocked: don't nag on every visit
  }
}

export function markTourSeen(email: string, id: TourId): void {
  try {
    localStorage.setItem(tourSeenKey(email, id), "1");
  } catch {
    // Storage blocked: the tour may show again next visit, which is harmless
  }
}

/** Forget every tour this student has seen (all tours show again). */
export function resetTours(email: string): void {
  try {
    const mine = `${PREFIX}:${norm(email)}:`;
    Object.keys(localStorage).filter((k) => k.startsWith(mine)).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Nothing to reset
  }
}

/** data-tour name, unless the target is already a CSS selector (#id or [attr]). */
export function targetSelector(target: string): string {
  return target.startsWith("#") || target.startsWith("[") ? target : `[data-tour="${target}"]`;
}

function isShown(el: Element, doc: Document): boolean {
  if (el.closest("[hidden]")) return false;
  const view = doc.defaultView;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  }
  return true;
}

/** Steps whose element is on the page and visible right now. */
export function availableSteps<T extends TourStep>(steps: readonly T[], doc: Document = document): T[] {
  return steps.filter((s) => {
    const el = doc.querySelector(targetSelector(s.target));
    return el !== null && isShown(el, doc);
  });
}

// ── The current page's tour, for the "Show me around" button ────────────────

type Starter = () => void;
let current: { id: TourId; start: Starter } | null = null;
const listeners = new Set<() => void>();

export function registerTour(id: TourId, start: Starter): () => void {
  const entry = { id, start };
  current = entry;
  listeners.forEach((l) => l());
  return () => {
    if (current === entry) current = null;
    listeners.forEach((l) => l());
  };
}

export const currentTour = () => current;

// ── Which tour is open right now (pages pause their clock while one is) ─────

let openTour: TourId | null = null;

export function setOpenTour(id: TourId | null): void {
  openTour = id;
  listeners.forEach((l) => l());
}

export const getOpenTour = () => openTour;

export function subscribeTours(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
