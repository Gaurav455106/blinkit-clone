// ── Category profiles (SPEC §3.3.3) ───────────────────────────────────────────
// Starting values for calibration (slice 1g). Slot 0 = 12–3 AM.

import type { CategoryProfile } from "@/market/types";

/** Protein & fitness: gym mornings and a strong 6–9 PM peak. */
export const PROTEIN: CategoryProfile = {
  id: "protein",
  slotShare:     [0.04, 0.02, 0.16, 0.10, 0.10, 0.12, 0.30, 0.16],
  intent:        [0.20, 0.20, 1.10, 0.80, 0.80, 0.90, 1.30, 1.00],
  rivalPressure: [0.70, 0.60, 1.00, 0.95, 0.95, 1.00, 1.25, 1.05],
  baseCTR: 0.02,
  baseCVR: 0.10,
  backgroundBidMedian: 340,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [4, 7],
};
