// ── The one slot definition (SPEC §3.3.5 #10) ─────────────────────────────────
// Slot 0 = 12–3 AM, matching the schedule editor (ProductBoosterSettings) and
// v1's dayEngine. Every v2 file uses these indices; a test pins the labels.

import { SLOT_COUNT } from "@/market/types";

export const SLOT_LABELS = [
  "12–3 AM", "3–6 AM", "6–9 AM", "9 AM–12 PM",
  "12–3 PM", "3–6 PM", "6–9 PM", "9 PM–12 AM",
] as const;

export const ALL_SLOTS: readonly number[] = Array.from({ length: SLOT_COUNT }, (_, i) => i);

/** A campaign with no schedule (or an empty one) runs 24/7. */
export function activeSlots(schedule: readonly number[] | undefined): readonly number[] {
  if (!schedule || schedule.length === 0) return ALL_SLOTS;
  return ALL_SLOTS.filter((s) => schedule.includes(s));
}
