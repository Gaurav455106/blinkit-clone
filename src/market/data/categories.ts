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
  baseCVR: 0.09,
  backgroundBidMedian: 340,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [4, 7],
};

/** Dog treats: morning walks and a 6–9 PM peak; impulse buys convert well. */
export const PET_TREATS: CategoryProfile = {
  id: "pet-treats",
  slotShare:     [0.03, 0.02, 0.18, 0.12, 0.10, 0.12, 0.25, 0.18],
  intent:        [0.30, 0.30, 1.15, 0.90, 0.85, 0.95, 1.25, 1.00],
  rivalPressure: [0.70, 0.60, 1.05, 0.95, 0.90, 1.00, 1.20, 1.05],
  baseCTR: 0.063,
  baseCVR: 0.205,
  backgroundBidMedian: 300,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [4, 7],
};

/** Pet accessories: considered purchases, browsed through the day; low CVR. */
export const PET_ACCESSORIES: CategoryProfile = {
  id: "pet-accessories",
  slotShare:     [0.04, 0.01, 0.08, 0.14, 0.16, 0.16, 0.22, 0.19],
  intent:        [0.50, 0.30, 0.80, 1.00, 1.00, 1.00, 1.15, 1.05],
  rivalPressure: [0.75, 0.60, 0.85, 0.95, 1.00, 1.00, 1.15, 1.05],
  baseCTR: 0.033,
  baseCVR: 0.09,
  backgroundBidMedian: 320,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [4, 7],
};

/** Premium skincare: evening routines; 9 PM–12 AM is the busiest slot. */
export const SKINCARE: CategoryProfile = {
  id: "skincare",
  slotShare:     [0.03, 0.01, 0.06, 0.10, 0.12, 0.14, 0.26, 0.28],
  intent:        [0.40, 0.20, 0.70, 0.90, 0.90, 1.00, 1.25, 1.15],
  rivalPressure: [0.70, 0.60, 0.80, 0.90, 0.90, 1.00, 1.20, 1.15],
  baseCTR: 0.029,
  baseCVR: 0.113,
  backgroundBidMedian: 380,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [4, 7],
};

/** Supplements: a young category on quick commerce; morning and evening routines. */
export const SUPPLEMENTS: CategoryProfile = {
  id: "supplements",
  slotShare:     [0.03, 0.02, 0.18, 0.14, 0.12, 0.12, 0.22, 0.17],
  intent:        [0.30, 0.30, 1.20, 1.00, 0.90, 0.90, 1.15, 0.90],
  rivalPressure: [0.70, 0.60, 1.05, 1.00, 0.95, 0.95, 1.15, 1.00],
  baseCTR: 0.015,
  baseCVR: 0.07,
  backgroundBidMedian: 300,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [3, 6],
};

/** Baby care: new parents shop mid-morning (9 AM–12 PM), not late evening. */
export const BABY: CategoryProfile = {
  id: "baby",
  slotShare:     [0.05, 0.04, 0.14, 0.24, 0.18, 0.12, 0.12, 0.11],
  intent:        [0.70, 0.60, 1.00, 1.30, 1.10, 0.90, 0.80, 0.80],
  rivalPressure: [0.80, 0.70, 1.00, 1.20, 1.10, 1.00, 0.95, 0.90],
  baseCTR: 0.039,
  baseCVR: 0.186,
  backgroundBidMedian: 320,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [4, 7],
};

/** Packaged snacks: cheap, impulse-led, strongest 9 PM–12 AM; crowded but cheaper CPMs. */
export const SNACKS: CategoryProfile = {
  id: "snacks",
  slotShare:     [0.08, 0.02, 0.06, 0.10, 0.12, 0.16, 0.20, 0.26],
  intent:        [0.60, 0.30, 0.60, 0.80, 0.90, 1.00, 1.10, 1.20],
  rivalPressure: [0.80, 0.60, 0.80, 0.90, 0.95, 1.00, 1.15, 1.20],
  baseCTR: 0.072,
  baseCVR: 0.3,
  backgroundBidMedian: 260,
  backgroundBidSigma: 0.35,
  backgroundBidderCount: [5, 8],
};
