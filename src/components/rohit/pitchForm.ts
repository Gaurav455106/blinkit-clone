// Pitch form state and checks for the CM pitch screen.

import type { CityName, OfflinePresence } from "@/data/scenarios";

export interface PitchRow {
  enabled: boolean;
  cities: CityName[];
  reasoning: string;
  justification: string;
  /** Units promised for states with no stock: state → units */
  stockCommitments: Record<string, number>;
}

export const emptyPitchRow = (): PitchRow => ({ enabled: false, cities: [], reasoning: "", justification: "", stockCommitments: {} });

/** Smallest and largest believable promise for a new state, by how fast the product sells. */
export function commitmentRange(velocity: string): { min: number; max: number } {
  if (velocity === "High") return { min: 100, max: 1000 };
  if (velocity === "Medium") return { min: 60, max: 600 };
  return { min: 30, max: 300 };
}

export type CommitValidity = "empty" | "too_low" | "ok" | "too_high";

export function commitValidity(units: number, velocity: string): CommitValidity {
  if (!units || units <= 0) return "empty";
  const { min, max } = commitmentRange(velocity);
  if (units < min) return "too_low";
  if (units > max) return "too_high";
  return "ok";
}

export const PRESENCE_LABEL: Readonly<Record<OfflinePresence, string>> = {
  strong: "Shops: sells well",
  moderate: "Shops: sells okay",
  weak: "Shops: barely sells",
  none: "Shops: not sold",
};
