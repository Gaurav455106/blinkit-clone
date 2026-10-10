// ── Market calendar: scheduled events in the 30-day run (SPEC §5, §10, decision Q4) ──
// Only calendar events live here: sale days, IPL evenings, paydays and festival
// peaks. The brief shows them in advance. Seeded surprise shocks (newcomer
// launch, rain, rival stock-out) are deliberately NOT part of this list.
//
// Day 1 is a Monday and the 1st of a 30-day month (same as context.ts), so
// paydays fall on days 1–3 and the next 1st is outside the run.

import type { BrandProfile, Scenario } from "@/data/scenarios";
import { MARKET_DATA } from "@/market/data";

export const RUN_DAYS = 30;
/** 0 = Sunday … 6 = Saturday. Day 1 is a Monday. */
const START_WEEKDAY = 1;

export type CalendarEventId = "sale_day" | "ipl_evening" | "payday" | "festival";

export interface CalendarEntry {
  id: CalendarEventId;
  fromDay: number;
  toDay: number;
  title: string;
  /** Plain description of what changes, e.g. "Searches ×1.6; rivals bid ×1.4". */
  effect: string;
  /** Categories this entry affects, in the brand's own category names. */
  categories: readonly string[];
  /** Multipliers for the engine to use later; 1 or absent = no change. */
  demandMult?: number;
  rivalBidMult?: number;
  /** Conversion lift on premium SKUs (payday). */
  premiumCvrMult?: number;
  /** 3-hour slot the demand lift applies to (slot 6 = 6–9 PM); absent = all day. */
  slot?: number;
}

export type CalendarScenario = Pick<Scenario, "profile" | "season">;

const IPL_CATEGORY_IDS = new Set(["snacks", "protein"]);
const EVENING_SLOT = 6;
/** Saturdays in the run when day 1 is a Monday. */
const SALE_DAY_OPTIONS = [13, 20] as const;
const FESTIVAL_DAYS = { from: 22, to: 26 } as const;
const PAYDAY_DAYS = { from: 1, to: 3 } as const;

/** 0 = Sunday … 6 = Saturday for a sim day (day 1 = Monday). */
export function weekdayOfDay(day: number): number {
  return (((START_WEEKDAY + day - 1) % 7) + 7) % 7;
}

/** Small stable string hash so each brand gets the same sale day every time. */
function stableHash(s: string): number {
  return [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

function saleDay(profile: BrandProfile): CalendarEntry {
  const day = SALE_DAY_OPTIONS[stableHash(profile.id) % SALE_DAY_OPTIONS.length];
  return {
    id: "sale_day",
    fromDay: day,
    toDay: day,
    title: "Big Savings Day",
    effect: "Searches ×1.6 (1.6 times a normal day). Rivals bid ×1.4. If you don't plan for it, your daily budget runs out by midday.",
    categories: ["All categories"],
    demandMult: 1.6,
    rivalBidMult: 1.4,
  };
}

function payday(profile: BrandProfile): CalendarEntry {
  return {
    id: "payday",
    fromDay: PAYDAY_DAYS.from,
    toDay: PAYDAY_DAYS.to,
    title: "Payday",
    effect: "Salaries arrive on the 1st. For three days, your pricier products sell about 10% better.",
    categories: profile.relevantCategories,
    premiumCvrMult: 1.1,
  };
}

function iplEvenings(profile: BrandProfile): CalendarEntry {
  return {
    id: "ipl_evening",
    fromDay: 1,
    toDay: RUN_DAYS,
    title: "IPL match evenings",
    effect: "On match days, searches from 6 to 9 PM are ×1.4. Rivals bid more in the evening too.",
    categories: profile.relevantCategories,
    demandMult: 1.4,
    slot: EVENING_SLOT,
  };
}

function festivalPeak(profile: BrandProfile): CalendarEntry {
  return {
    id: "festival",
    fromDay: FESTIVAL_DAYS.from,
    toDay: FESTIVAL_DAYS.to,
    title: "Festival peak week",
    effect: "Searches ×1.3, on top of the festive season boost. Rivals bid ×1.2. Stock runs out faster.",
    categories: profile.relevantCategories,
    demandMult: 1.3,
    rivalBidMult: 1.2,
  };
}

function hasIpl(profile: BrandProfile): boolean {
  const categoryId = MARKET_DATA[profile.id]?.category.id;
  return categoryId !== undefined && IPL_CATEGORY_IDS.has(categoryId);
}

/** The scheduled events for this brand and season, sorted by start day. Deterministic. */
export function marketCalendar(scenario: CalendarScenario): readonly CalendarEntry[] {
  const { profile, season } = scenario;
  const entries: CalendarEntry[] = [
    payday(profile),
    saleDay(profile),
    ...(hasIpl(profile) ? [iplEvenings(profile)] : []),
    ...(season.name === "Festival Surge" ? [festivalPeak(profile)] : []),
  ];
  return [...entries].sort((a, b) => a.fromDay - b.fromDay || a.toDay - b.toDay);
}

/** Entries active on a given day. */
export function calendarEntriesOnDay(entries: readonly CalendarEntry[], day: number): CalendarEntry[] {
  return entries.filter((e) => day >= e.fromDay && day <= e.toDay);
}
