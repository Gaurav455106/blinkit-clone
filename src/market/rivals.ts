// ── Rivals: daily reaction rules (SPEC §4, §14 F11) ───────────────────────────
// Rivals can't see the student's bids; they react only to their own SOV and
// ROAS, after a lag. Order each day: ROAS floor, then low SOV, then high SOV.

import type { RivalData } from "@/market/types";

const ROAS_CUT = 0.9;
const LOW_SOV_RAISE = 1.15;
const HIGH_SOV_DRIFT = 0.95;
const LOW_SOV_GAP = 0.1;
const HIGH_SOV_GAP = 0.15;
/** Bids never drift below half the starting level. */
const MIN_BID_MULT = 0.5;

export interface RivalState {
  id: string;
  /** Current multiplier on the rival's starting bids. */
  bidMult: number;
  /** Consecutive days with SOV more than 10pp under target. */
  lowSovStreak: number;
  /** ₹ spent so far this run. */
  spent: number;
}

/** What the rival saw yesterday. */
export interface RivalDayStats {
  /** Its position-weighted SOV across its keywords (placements don't count). */
  sov: number;
  /** Its keyword ROAS over the last 3 days; null if it had no keyword spend. */
  roas3d: number | null;
  /** All spend today, keywords and placements (counts against its budget). */
  spend: number;
}

export function initialRivalState(rival: RivalData): RivalState {
  return { id: rival.id, bidMult: 1, lowSovStreak: 0, spent: 0 };
}

export function updateRival(rival: RivalData, state: RivalState, yesterday: RivalDayStats): RivalState {
  const spent = state.spent + yesterday.spend;
  const clampMult = (m: number) => Math.min(rival.maxBidMult, Math.max(MIN_BID_MULT, m));

  if (yesterday.roas3d !== null && yesterday.roas3d < rival.roasFloor) {
    return { ...state, spent, bidMult: clampMult(state.bidMult * ROAS_CUT), lowSovStreak: 0 };
  }
  if (yesterday.sov < rival.targetSov - LOW_SOV_GAP) {
    const lowSovStreak = state.lowSovStreak + 1;
    const bidMult = lowSovStreak >= rival.lagDays ? clampMult(state.bidMult * LOW_SOV_RAISE) : state.bidMult;
    return { ...state, spent, bidMult, lowSovStreak };
  }
  if (yesterday.sov > rival.targetSov + HIGH_SOV_GAP) {
    return { ...state, spent, bidMult: clampMult(state.bidMult * HIGH_SOV_DRIFT), lowSovStreak: 0 };
  }
  return { ...state, spent, lowSovStreak: 0 };
}

/** The rival's effective bid for a keyword or placement in a slot, or null if it isn't in this auction. */
export function rivalBid(
  rival: RivalData,
  state: RivalState,
  term: string,
  day: number,
  slotPressure: number,
): number | null {
  const start = rival.bids[term] ?? rival.placementBids?.[term];
  if (start === undefined) return null;
  if (day < (rival.activeFromDay ?? 1)) return null;
  if (state.spent >= rival.monthlyBudget) return null;
  const inBurst = rival.burst !== undefined && day >= rival.burst.fromDay && day <= rival.burst.toDay;
  const burstMult = inBurst ? rival.burst!.bidMult : 1;
  return start * state.bidMult * burstMult * slotPressure;
}

export function rivalPrice(rival: RivalData, day: number): number {
  if (rival.priceCut && day >= rival.priceCut.day) return rival.price * (1 - rival.priceCut.pct);
  return rival.price;
}
