// ── Achievements (SPEC §15) ───────────────────────────────────────────────────
// Badges for what the student actually did, derived from the run each time
// (nothing stored), so a replay or reload shows the same set.

import { applyActions, type LiveAction } from "@/market/actions";
import { sumMetrics } from "@/market/aggregate";
import type { CampaignConfig, DayResult } from "@/market/engineTypes";

export interface Achievement {
  id: string;
  title: string;
  detail: string;
}

export interface AchievementInput {
  launched: readonly CampaignConfig[];
  actions: readonly LiveAction[];
  insights: number;
  rohitReplies: number;
  /** Last completed day. */
  day: number;
  results: readonly DayResult[];
}

const DEAD_SLOTS = [0, 1];
const WEEK_DAYS = [7, 14, 21];
const MIN_DAYS_FOR_PROFIT = 3;

const DEFS: Readonly<Record<string, Omit<Achievement, "id">>> = {
  first_move: { title: "First move", detail: "You changed a live campaign. Real managers adjust every day." },
  night_off: { title: "Night shift off", detail: "You stopped paying for ads between midnight and 6 AM." },
  trimmed: { title: "Trimmed a loser", detail: "You cut a bid or paused something that cost more than it earned." },
  backed_winner: { title: "Backed a winner", detail: "You put more money or a higher bid behind what works." },
  rohit: { title: "Rohit's on your side", detail: "You answered Rohit's check-in." },
  analyst: { title: "Analyst", detail: "You logged an insight from the reports." },
  in_the_black: { title: "In the black", detail: "Your ads are earning back more than they cost." },
  week_1: { title: "Week 1 done", detail: "Seven days run. Check the reports and adjust." },
  week_2: { title: "Week 2 done", detail: "Halfway there." },
  week_3: { title: "Week 3 done", detail: "One week to go. Finish strong." },
  day_30: { title: "Day 30", detail: "You ran the full month." },
};

/** Every achievement, in display order, earned or not. */
export const ALL_ACHIEVEMENTS: readonly Achievement[] = Object.entries(DEFS).map(([id, d]) => ({ id, ...d }));

/** The bid an action changes, as it stood just before the action. */
function previousBid(launched: readonly CampaignConfig[], actions: readonly LiveAction[], i: number): number | undefined {
  const a = actions[i];
  const before = applyActions(launched, actions.slice(0, i), Number.POSITIVE_INFINITY).find((c) => c.id === a.campaignId);
  if (!before) return undefined;
  if (a.change.kind === "keywordBid") { const term = a.change.term; return before.keywords.find((k) => k.term === term)?.exactBid; }
  if (a.change.kind === "placementBid") { const id = a.change.id; return before.placements?.find((p) => p.id === id)?.bid; }
  if (a.change.kind === "budget") return before.budget;
  return undefined;
}

export function earnedAchievements(input: AchievementInput): Achievement[] {
  const { launched, actions } = input;
  const ids = new Set<string>();
  if (actions.length > 0) ids.add("first_move");
  actions.forEach((a, i) => {
    const c = a.change;
    if (c.kind === "schedule" && DEAD_SLOTS.every((s) => !c.schedule.includes(s))) ids.add("night_off");
    if (c.kind === "pauseKeyword" && c.paused) ids.add("trimmed");
    if (c.kind === "keywordBid" || c.kind === "placementBid" || c.kind === "budget") {
      const before = previousBid(launched, actions, i);
      const after = c.kind === "budget" ? c.budget : c.bid;
      if (before !== undefined && after < before && c.kind !== "budget") ids.add("trimmed");
      if (before !== undefined && after > before) ids.add("backed_winner");
    }
  });
  if (input.rohitReplies > 0) ids.add("rohit");
  if (input.insights > 0) ids.add("analyst");
  if (input.results.length >= MIN_DAYS_FOR_PROFIT) {
    const m = sumMetrics(input.results.flatMap((r) => r.cells));
    if (m.spend > 0 && m.contribution >= m.spend) ids.add("in_the_black");
  }
  WEEK_DAYS.forEach((d, i) => { if (input.day >= d) ids.add(`week_${i + 1}`); });
  if (input.day >= 30) ids.add("day_30");
  return Object.keys(DEFS).filter((id) => ids.has(id)).map((id) => ({ id, ...DEFS[id] }));
}

/** Achievements in `now` that weren't in `seen` (ids), in the order earned. */
export function newAchievements(now: readonly Achievement[], seen: readonly string[]): Achievement[] {
  const old = new Set(seen);
  return now.filter((a) => !old.has(a.id));
}
