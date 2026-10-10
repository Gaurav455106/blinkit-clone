// ── MARKET_DATA: one BrandMarket per brand id ─────────────────────────────────

import type { BrandMarket } from "@/market/types";
import { FUELUP } from "@/market/data/fuelup";
import { HENLO } from "@/market/data/henlo";
import { GLOW } from "@/market/data/glow";
import { VITABOOST } from "@/market/data/vitaboost";
import { TINYBUDDY } from "@/market/data/tinybuddy";
import { MUNCHBOX } from "@/market/data/munchbox";
import { PAWLIFE } from "@/market/data/pawlife";

export const MARKET_DATA: Readonly<Record<string, BrandMarket>> = {
  henlo: HENLO,
  glow: GLOW,
  vitaboost: VITABOOST,
  tinybuddy: TINYBUDDY,
  munchbox: MUNCHBOX,
  pawlife: PAWLIFE,
  fuelup: FUELUP,
};
