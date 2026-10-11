// ── Live run logic (SPEC §2, §5, §6, §8): pure helpers for the v2 dashboard ──
// What happens after each completed day (new events, the one alert that may
// pause the clock, a Rohit check-in), how a live action maps to the levers
// events reward, how replies that drop states become campaign changes, and the
// relationship meter. The dashboard hook only stores and displays the results.

import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { applyActions, type LiveAction } from "@/market/actions";
import {
  evaluateEvents, selectAlerts, servedStates,
  type CalendarEntry, type EventActivation, type LeverId,
} from "@/market/events";
import {
  pickCheckIns, clampRelationship, relationshipChange, CHECK_IN_DAYS, MAX_CHECKINS_PER_RUN,
  type AskId, type CommitmentResult, type ReplyQuality, type RohitAsk,
} from "@/market/rohit";

// ── After each day ───────────────────────────────────────────────────────────

export interface AfterDayInput {
  ctx: MarketContext;
  /** State after the day that just finished (day 0 = before the run). */
  state: MarketState;
  history: readonly DayResult[];
  /** Campaigns as they will run tomorrow. */
  campaigns: readonly CampaignConfig[];
  calendar: readonly CalendarEntry[];
  existing: readonly EventActivation[];
  /** Pausing alerts already shown this run. */
  pausingShown: number;
  asked: readonly AskId[];
  relationship: number;
  campaignNames?: Readonly<Record<string, string>>;
}

export interface AfterDayOutcome {
  fresh: readonly EventActivation[];
  /** The alert that pauses the clock now, or null. */
  pausing: EventActivation | null;
  /** Rohit's check-in, on check-in days when something applies. */
  ask: RohitAsk | null;
}

export function afterDay(input: AfterDayInput): AfterDayOutcome {
  const { ctx, state, history, campaigns, calendar, campaignNames } = input;
  const fresh = evaluateEvents({ ctx, state, history, campaigns, calendar, campaignNames }, input.existing);
  const { pausing } = selectAlerts(fresh, 0, input.pausingShown);
  const ask = checkInDue(state.day, input.asked)
    ? pickCheckIns({ ctx, state, history, campaigns, relationship: input.relationship }, input.asked)
    : null;
  return { fresh, pausing, ask };
}

/**
 * True when the next check-in is due: from its suggested day (6, 13, 20) until
 * one is actually asked, so a day with nothing to ask doesn't lose it.
 */
export function checkInDue(day: number, asked: readonly AskId[]): boolean {
  const due = CHECK_IN_DAYS[asked.length];
  return asked.length < MAX_CHECKINS_PER_RUN && due !== undefined && day >= due;
}

// ── Which levers an action pulls ─────────────────────────────────────────────

function statesOf(c: CampaignConfig | undefined, ctx: MarketContext): readonly string[] {
  if (!c) return [];
  if (c.geography === "pan_india") {
    return Object.entries(ctx.scenario.cityStockMap).filter(([, v]) => (v ?? 0) > 0).map(([s]) => s);
  }
  return c.cities;
}

/** The levers one action pulls, read against the campaigns as they were before it. */
export function actionLevers(action: LiveAction, before: readonly CampaignConfig[], ctx: MarketContext): LeverId[] {
  const c = before.find((x) => x.id === action.campaignId);
  const ch = action.change;
  switch (ch.kind) {
    case "keywordBid":
    case "smartBid": {
      const old = c?.keywords.find((k) => k.term === ch.term);
      const prevBid = ch.kind === "keywordBid" ? old?.exactBid : old?.smartBid;
      const next = ch.bid ?? 0;
      if (prevBid === undefined) return ["raise_bid"];
      return next > prevBid ? ["raise_bid"] : next < prevBid ? ["lower_bid"] : [];
    }
    case "placementBid": {
      const old = c?.placements?.find((p) => p.id === ch.id)?.bid ?? 0;
      return ch.bid > old ? ["raise_bid"] : ch.bid < old ? ["lower_bid"] : [];
    }
    case "pauseKeyword":
      return ch.paused ? ["pause_keyword"] : ["add_keyword"];
    case "addKeyword": {
      const kw = ctx.market.keywords.find((k) => k.term === ch.term);
      return ["add_keyword", ...(kw?.isBrandTerm ? ["defend_brand_term" as const] : []), ...(kw?.tier === "long" ? ["shift_to_long_tail" as const] : [])];
    }
    case "budget": {
      const old = c?.budget ?? 0;
      return ch.budget > old ? ["raise_budget", "raise_state_budget"] : ch.budget < old ? ["lower_budget"] : [];
    }
    case "states": {
      const was = new Set(statesOf(c, ctx));
      const now = new Set(ch.geography === "pan_india" ? statesOf({ ...(c as CampaignConfig), geography: "pan_india" }, ctx) : ch.cities);
      const levers: LeverId[] = [];
      if ([...now].some((s) => !was.has(s))) levers.push("add_state");
      if ([...was].some((s) => !now.has(s))) levers.push("remove_state");
      return levers;
    }
    case "schedule":
      return ["daypart"];
    case "pause":
      return ch.paused ? ["lower_budget"] : ["raise_budget"];
  }
}

// ── Scoring the response to each pausing alert (SPEC §5 "Right response") ───

export type EventVerdict = "right" | "other" | "none" | "held";
const OTHER_ACTION_SHARE = 0.4;

export interface EventResponse {
  activation: EventActivation;
  verdict: EventVerdict;
  /** Levers the student pulled inside the decision window. */
  pulled: readonly LeverId[];
}

export function scoreEventResponses(
  alerts: readonly EventActivation[],
  actions: readonly LiveAction[],
  launched: readonly CampaignConfig[],
  ctx: MarketContext,
): { items: readonly EventResponse[]; share: number } {
  if (alerts.length === 0) return { items: [], share: 1 };
  const items = alerts.map((a): EventResponse => {
    const from = a.raisedAfterDay;
    const inWindow = actions.filter((x) => x.dayMade >= from && x.dayMade < from + a.decisionWindowDays);
    const pulled = Array.from(new Set(inWindow.flatMap((x) => {
      const before = applyBefore(launched, actions, x);
      return actionLevers(x, before, ctx);
    })));
    const right = pulled.some((l) => a.rightLevers.includes(l));
    const verdict: EventVerdict = right ? "right"
      : pulled.length === 0 && a.rightLevers.includes("hold") ? "held"
      : pulled.length > 0 ? "other" : "none";
    return { activation: a, verdict, pulled };
  });
  const value = (v: EventVerdict) => (v === "right" || v === "held" ? 1 : v === "other" ? OTHER_ACTION_SHARE : 0);
  return { items, share: items.reduce((s, i) => s + value(i.verdict), 0) / items.length };
}

/** Campaigns as they stood just before an action (earlier actions applied). */
function applyBefore(launched: readonly CampaignConfig[], actions: readonly LiveAction[], action: LiveAction): CampaignConfig[] {
  const idx = actions.indexOf(action);
  return applyActions(launched, actions.slice(0, idx < 0 ? actions.length : idx), Number.POSITIVE_INFINITY);
}

// ── Rohit replies ────────────────────────────────────────────────────────────

/** Campaign changes for a reply that pulls ads out of some states. */
export function dropStatesActions(
  configs: readonly CampaignConfig[],
  served: readonly string[],
  drop: readonly string[],
  dayMade: number,
): LiveAction[] {
  const dropped = new Set(drop);
  return configs.flatMap((c): LiveAction[] => {
    const current = c.geography === "pan_india" ? served : c.cities;
    if (!current.some((s) => dropped.has(s))) return [];
    const keep = current.filter((s) => !dropped.has(s));
    return [{
      campaignId: c.id, dayMade,
      change: keep.length === 0 ? { kind: "pause", paused: true } : { kind: "states", geography: "select_cities", cities: keep },
    }];
  });
}

export { servedStates };

export const ROHIT_QUALITY_SHARE: Readonly<Record<ReplyQuality, number>> = { strong: 1, ok: 0.6, weak: 0.2 };

/** The meter now: the pitch's starting value, reply effects and resolved promises. */
export function relationshipNow(
  base: number,
  replies: readonly { delta: number }[],
  commitments: readonly CommitmentResult[],
): number {
  return clampRelationship(base + replies.reduce((s, r) => s + r.delta, 0) + relationshipChange(commitments));
}
