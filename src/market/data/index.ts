// ── MARKET_DATA: one BrandMarket per brand id ─────────────────────────────────
// FuelUp first (slice 1c); the other six brands follow.

import type { BrandMarket } from "@/market/types";
import { FUELUP } from "@/market/data/fuelup";

export const MARKET_DATA: Readonly<Record<string, BrandMarket>> = {
  fuelup: FUELUP,
};
