// Budget split guidance per goal type (kept from v1 Brief).

import type { GoalType } from "@/data/scenarios";

/** Recommended share of budget for conversion campaigns, by goal type. */
export const RECOMMENDED_CONVERSION: Record<GoalType, { min: number; max: number; reason: string }> = {
  "ROAS-First": { min: 60, max: 80, reason: "Brands that need a good return should spend most on sales ads" },
  "Volume-First": { min: 50, max: 65, reason: "Brands chasing units need mostly sales ads, plus some reach" },
  "Awareness-First": { min: 20, max: 40, reason: "Brands that need to get noticed should spend most on reach" },
  "Category-Creation": { min: 20, max: 40, reason: "People need to hear about a new kind of product before they search for it" },
  "Inventory-Clearance": { min: 80, max: 100, reason: "Clearing old stock needs sales ads, not awareness" },
};

export function defaultConversionPct(goalType: GoalType): number {
  return goalType === "ROAS-First" ? 70 : goalType === "Volume-First" ? 60 : goalType === "Inventory-Clearance" ? 90 : 30;
}
