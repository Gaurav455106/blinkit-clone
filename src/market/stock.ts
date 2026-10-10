// ── Stock and OSA (SPEC §3.4, §14 F6) ─────────────────────────────────────────
// Units per SKU × state. OSA = share of the state's dark stores in stock,
// derived from units, so "OSA < 50%" and "out of stock" come from one number.

import type { Velocity, InventoryState } from "@/data/scenarios";

/** Units a dark store holds when "fully stocked", by SKU velocity. */
export const SAFETY_UNITS_PER_STORE: Readonly<Record<Velocity, number>> = {
  "High": 6,
  "Medium": 4,
  "Low": 3,
  "Very Low": 2,
};

/** Days of cover each restock tops up to, by scenario inventory tone. */
export const TARGET_COVER_DAYS: Readonly<Record<InventoryState["tone"], number>> = {
  healthy: 21,
  warning: 10,
  critical: 4,
  overstocked: 45,
};

export const RESTOCK_INTERVAL_DAYS = 7;

/** Organic sales get a small lift from the brand's ad SOV. */
const ORGANIC_SOV_HALO = 0.1;

function fullStock(stores: number, velocity: Velocity): number {
  return stores * SAFETY_UNITS_PER_STORE[velocity];
}

export function osa(units: number, stores: number, velocity: Velocity): number {
  const full = fullStock(stores, velocity);
  if (full <= 0) return 0;
  return Math.min(1, Math.max(0, units / full));
}

/** Starting units that reproduce the scenario's OSA % for a state. */
export function initialUnits(osaPct: number, stores: number, velocity: Velocity): number {
  return (Math.max(0, osaPct) / 100) * fullStock(stores, velocity);
}

/** Organic units wanted in a state today, before the stock limit. */
export function organicDemand(
  nationalDailyUnits: number,
  stateShare: number,
  dowMult: number,
  seasonMult: number,
  sov: number,
): number {
  return nationalDailyUnits * stateShare * dowMult * seasonMult * (1 + ORGANIC_SOV_HALO * sov);
}

export function sellFrom(units: number, wanted: number): { sold: number; remaining: number } {
  const sold = Math.min(Math.max(0, units), Math.max(0, wanted));
  return { sold, remaining: units - sold };
}

export function isRestockDay(day: number): boolean {
  return day > 0 && day % RESTOCK_INTERVAL_DAYS === 0;
}

/** Units to add so stock covers the target days at the recent sales rate. */
export function restockAmount(
  units: number,
  avgDailyUnits7d: number,
  tone: InventoryState["tone"],
): number {
  return Math.max(0, avgDailyUnits7d * TARGET_COVER_DAYS[tone] - units);
}
