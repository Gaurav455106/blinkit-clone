// ── Stock and OSA (SPEC §3.4, §14 F6) ─────────────────────────────────────────
// Units per SKU × state. OSA = share of the state's dark stores in stock,
// derived from units, so "OSA < 50%" and "out of stock" come from one number.
// Units are spread unevenly across stores, so OSA rises along a saturating
// curve: OSA = 1 − e^(−units ÷ (stores × k)). Extra units beyond that add
// days of cover, not OSA. With k = 1 and ~5 units/day, 21 / 10 / 4 days of
// cover give roughly 86% / 61% / 32% OSA in a 53-store state.

import type { Velocity, InventoryState } from "@/data/scenarios";

/** k: units per store at which ~63% of stores are in stock, by SKU velocity
 *  (fast sellers need deeper stock to stay on shelf all day). */
export const SAFETY_UNITS_PER_STORE: Readonly<Record<Velocity, number>> = {
  "High": 3,
  "Medium": 2,
  "Low": 1,
  "Very Low": 0.7,
};

/** Starting OSA is capped here so starting units stay finite. */
const MAX_START_OSA = 0.99;

/** Ad units sold per organic unit, assumed when sizing starting stock. Headless runs of
 *  every brand put it between 0.4 and 2.4 in week 1 (median ~1.8); 2 keeps a typical
 *  account near its target cover without starving the heavy-ad brands. */
export const START_AD_DEMAND_RATIO = 2;

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

function scale(stores: number, velocity: Velocity): number {
  return stores * SAFETY_UNITS_PER_STORE[velocity];
}

export function osa(units: number, stores: number, velocity: Velocity): number {
  const k = scale(stores, velocity);
  if (k <= 0 || units <= 0) return 0;
  return 1 - Math.exp(-units / k);
}

/** Starting units that reproduce the scenario's OSA % for a state. */
export function initialUnits(osaPct: number, stores: number, velocity: Velocity): number {
  const target = Math.min(MAX_START_OSA, Math.max(0, osaPct) / 100);
  if (target <= 0) return 0;
  return -scale(stores, velocity) * Math.log(1 - target);
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
