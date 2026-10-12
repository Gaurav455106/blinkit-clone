// ── Live optimisation actions (SPEC §7) ───────────────────────────────────────
// Every action applies from the day after it is made, as on a real ads
// platform. Actions are stored as a log and replayed onto the launched
// campaigns, so a run can be rebuilt exactly (the engine is deterministic).

import type { CampaignConfig, KeywordBid, PlacementBid } from "@/market/engineTypes";
import { formatRupees } from "@/lib/money";

export type ActionChange =
  | { kind: "keywordBid"; term: string; bid: number }
  | { kind: "smartBid"; term: string; bid: number | null }
  | { kind: "pauseKeyword"; term: string; paused: boolean }
  | { kind: "addKeyword"; term: string; bid: number }
  | { kind: "placementBid"; id: string; bid: number }
  | { kind: "budget"; budget: number }
  | { kind: "states"; geography: "pan_india" | "select_cities"; cities: readonly string[] }
  | { kind: "schedule"; schedule: readonly number[] }
  | { kind: "pause"; paused: boolean };

export interface LiveAction {
  campaignId: string;
  dayMade: number;
  change: ActionChange;
}

export interface ChangeLogEntry {
  dayMade: number;
  dayApplied: number;
  campaignId: string;
  what: string;
  from: string;
  to: string;
}

interface Working {
  config: CampaignConfig;
  pausedKeywords: ReadonlySet<string>;
}

function applyOne(w: Working, change: ActionChange): Working {
  const c = w.config;
  switch (change.kind) {
    case "keywordBid":
      return { ...w, config: { ...c, keywords: c.keywords.map((k) => (k.term === change.term ? { ...k, exactBid: change.bid } : k)) } };
    case "smartBid":
      return {
        ...w,
        config: {
          ...c,
          keywords: c.keywords.map((k): KeywordBid => {
            if (k.term !== change.term) return k;
            if (change.bid === null) return { term: k.term, exactBid: k.exactBid };
            return { ...k, smartBid: change.bid };
          }),
        },
      };
    case "pauseKeyword": {
      const next = new Set(w.pausedKeywords);
      if (change.paused) next.add(change.term);
      else next.delete(change.term);
      return { ...w, pausedKeywords: next };
    }
    case "addKeyword":
      if (c.keywords.some((k) => k.term === change.term)) return w;
      return { ...w, config: { ...c, keywords: [...c.keywords, { term: change.term, exactBid: change.bid }] } };
    case "placementBid": {
      const placements: PlacementBid[] = (c.placements ?? []).some((p) => p.id === change.id)
        ? (c.placements ?? []).map((p) => (p.id === change.id ? { ...p, bid: change.bid } : p))
        : [...(c.placements ?? []), { id: change.id, bid: change.bid }];
      return { ...w, config: { ...c, placements } };
    }
    case "budget":
      return { ...w, config: { ...c, budget: change.budget } };
    case "states":
      return { ...w, config: { ...c, geography: change.geography, cities: change.cities } };
    case "schedule":
      return { ...w, config: { ...c, schedule: change.schedule } };
    case "pause":
      return { ...w, config: { ...c, paused: change.paused } };
  }
}

/** Campaigns as they run on `day`: every action made before that day, in order. */
export function applyActions(campaigns: readonly CampaignConfig[], actions: readonly LiveAction[], day: number): CampaignConfig[] {
  return campaigns.map((campaign) => {
    const relevant = actions.filter((a) => a.campaignId === campaign.id && a.dayMade < day);
    const final = relevant.reduce((w, a) => applyOne(w, a.change), { config: campaign, pausedKeywords: new Set<string>() } as Working);
    return {
      ...final.config,
      keywords: final.config.keywords.filter((k) => !final.pausedKeywords.has(k.term)),
    };
  });
}

const rupees = (n: number | null | undefined) => (n === null || n === undefined ? "off" : formatRupees(n));
const slots = (s: readonly number[] | undefined) => (s && s.length ? `${s.length} slots` : "24/7");

/** Human-readable change-log entry (report R11), describing the state just before the action. */
export function recordAction(current: readonly CampaignConfig[], action: LiveAction): ChangeLogEntry {
  const c = current.find((x) => x.id === action.campaignId);
  const ch = action.change;
  const base = { dayMade: action.dayMade, dayApplied: action.dayMade + 1, campaignId: action.campaignId };
  switch (ch.kind) {
    case "keywordBid":
      return { ...base, what: `Bid on "${ch.term}"`, from: rupees(c?.keywords.find((k) => k.term === ch.term)?.exactBid), to: rupees(ch.bid) };
    case "smartBid":
      return { ...base, what: `Smart bid on "${ch.term}"`, from: rupees(c?.keywords.find((k) => k.term === ch.term)?.smartBid ?? null), to: rupees(ch.bid) };
    case "pauseKeyword":
      return { ...base, what: `Keyword "${ch.term}"`, from: ch.paused ? "running" : "paused", to: ch.paused ? "paused" : "running" };
    case "addKeyword":
      return { ...base, what: `Added keyword "${ch.term}"`, from: "not running", to: rupees(ch.bid) };
    case "placementBid":
      return { ...base, what: `Bid on ${ch.id}`, from: rupees(c?.placements?.find((p) => p.id === ch.id)?.bid), to: rupees(ch.bid) };
    case "budget":
      return { ...base, what: "Budget", from: rupees(c?.budget), to: rupees(ch.budget) };
    case "states":
      return { ...base, what: "States", from: c?.geography === "pan_india" ? "Pan India" : (c?.cities ?? []).join(", "), to: ch.geography === "pan_india" ? "Pan India" : ch.cities.join(", ") };
    case "schedule":
      return { ...base, what: "Schedule", from: slots(c?.schedule), to: slots(ch.schedule) };
    case "pause":
      return { ...base, what: "Campaign", from: c?.paused ? "paused" : "running", to: ch.paused ? "paused" : "running" };
  }
}
