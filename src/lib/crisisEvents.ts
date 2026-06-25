import type { Scenario } from "@/data/scenarios";

export interface CrisisAutoAction {
  type: "pause_affected_state" | "none";
  /** How many days after crisis.day does stock restore? Fires notification when currentDay >= crisis.day + restoreAfterDays */
  restoreAfterDays?: number;
}

export interface CrisisOption {
  key: "a" | "b" | "c" | "d";
  label: string;
  effect: string;
  score: number;
  best?: boolean;
  autoAction?: CrisisAutoAction;
}

export interface CrisisSpec {
  num: 1 | 2 | 3;
  day: number;
  icon: string;
  title: string;
  subtitle?: string;
  tone: "red" | "orange" | "blue";
  message: string;
  options: CrisisOption[];
}

export interface CrisisCtx {
  heroSku: string;
  secondarySku: string;
  topState: string;
}

export function getCrisisCtx(scenario: Scenario): CrisisCtx {
  const skus = scenario.profile.skus ?? [];
  return {
    heroSku: skus[0]?.name ?? "Hero SKU",
    secondarySku: skus[1]?.name ?? skus[0]?.name ?? "Secondary SKU",
    topState: scenario.profile.primaryState ?? "your top state",
  };
}

export function buildCrisis(num: 1 | 2 | 3, scenario: Scenario): CrisisSpec {
  const c = getCrisisCtx(scenario);
  if (num === 1) {
    return {
      num: 1,
      day: 9,
      icon: "🚨",
      title: "Mid-Campaign Alert — Day 9",
      subtitle: "Supply Team Notification",
      tone: "red",
      message: `Fill rate dropped to 62% in ${c.topState}. Your highest-performing dark stores are running critically low on ${c.heroSku}. You have a 48-hour decision window.`,
      options: [
        { key: "a", label: "Pause ads in affected state immediately", effect: `Ads paused in ${c.topState}; budget freed for other states.`, score: 10, autoAction: { type: "pause_affected_state", restoreAfterDays: 6 } },
        { key: "b", label: "Continue campaign, hope stock arrives", effect: `Stock runs out by Day 12, ROAS drops ~50% in ${c.topState} for the remainder.`, score: 0 },
        { key: "c", label: "Request emergency restock AND pause ads", effect: `Stock returns to 80% by Day 11. Costs ₹8,000 from remaining budget.`, score: 15, best: true, autoAction: { type: "pause_affected_state", restoreAfterDays: 2 } },
      ],
    };
  }
  if (num === 2) {
    return {
      num: 2,
      day: 18,
      icon: "📞",
      title: "Category Manager Alert — Day 18",
      subtitle: "Rohit Sharma, Category Manager",
      tone: "orange",
      message: `"Your ${c.secondarySku} has only 14% sell-through in 18 days. I have other brands waiting for that shelf space. Give me a plan in 24 hours or I'm pulling the listing."`,
      options: [
        { key: "a", label: "Drop price by 20% to drive trial", effect: `Sales spike ~40% for 5 days; margin reduced.`, score: 10 },
        { key: "b", label: `Accept delist, focus budget on ${c.heroSku}`, effect: `${c.secondarySku} stops selling; budget redirects to hero SKU.`, score: 12 },
        { key: "c", label: "Swap with better-performing SKU from portfolio", effect: `Replaced with high-velocity SKU; sales improve ~60%.`, score: 15, best: true },
        { key: "d", label: "Promise improvement, request 1-week extension", effect: `Buys time but pressure continues; CM watches closely.`, score: 2 },
      ],
    };
  }
  // Crisis 3 — scenario-aware
  const season = (scenario.season ?? "").toString();
  const market = (scenario.market?.name ?? "").toString();
  if (/festival/i.test(season)) {
    return {
      num: 3,
      day: 25,
      icon: "⚡",
      title: "Strategic Decision — Day 25",
      subtitle: "Festival Surge incoming",
      tone: "blue",
      message: `Diwali is in 5 days. Category demand expected to spike 60%. CPMs are already rising. How do you allocate the final 5 days?`,
      options: [
        { key: "a", label: "Front-load all remaining budget in next 3 days", effect: `High visibility pre-peak; budget may exhaust before peak day.`, score: 8 },
        { key: "b", label: "Maintain steady spend, ride the wave", effect: `Consistent performance, miss peak opportunity.`, score: 10 },
        { key: "c", label: "Save 50% of remaining budget for peak (Day 28-30)", effect: `Maximum peak impact, +35% revenue on peak days.`, score: 15, best: true },
      ],
    };
  }
  if (/aggressive/i.test(market) || /competitor/i.test(market)) {
    return {
      num: 3,
      day: 25,
      icon: "⚡",
      title: "Strategic Decision — Day 25",
      subtitle: "Competitor undercut",
      tone: "blue",
      message: `Your top competitor just slashed prices 22%. Conversion rate dropped 35% in last 4 hours. Final week strategy?`,
      options: [
        { key: "a", label: "Match their price", effect: `Stops the bleed but margin hit; ROAS drops 30%.`, score: 8 },
        { key: "b", label: "Double ad spend to maintain visibility", effect: `Higher impressions but inflated CPCs; ROAS drops 40%.`, score: 3 },
        { key: "c", label: "Pivot to long-tail keywords competitor isn't bidding on", effect: `Lower volume but ROAS recovers; +20% efficiency.`, score: 15, best: true },
      ],
    };
  }
  return {
    num: 3,
    day: 25,
    icon: "⚡",
    title: "Strategic Decision — Day 25",
    subtitle: "Ranking opportunity",
    tone: "blue",
    message: `Your top SKU is at organic rank #11. With aggressive push in next 5 days, top 5 ranking is achievable. Strategy?`,
    options: [
      { key: "a", label: "Push hard with 40% of remaining budget", effect: `Achieves top-5 rank; sales sustain after campaign.`, score: 15, best: true },
      { key: "b", label: "Moderate push, balanced approach", effect: `Reaches rank #8; modest gain.`, score: 10 },
      { key: "c", label: "Maintain current spend, let organic growth happen", effect: `Rank stays at #11; no improvement.`, score: 5 },
    ],
  };
}

// Day-level multiplicative modifiers applied to spend/revenue for days >= a threshold.
export interface DayMod { spendMult: number; revMult: number; spendAdd: number }

/** Optional scenario context so crisis 3 effects branch correctly by scenario type. */
export interface ModifierContext {
  seasonName?: string;
  marketName?: string;
}

export function modifierForDay(
  day: number,
  decisions: { num: 1 | 2 | 3; optionKey: string }[],
  ctx?: ModifierContext,
): DayMod {
  let spendMult = 1, revMult = 1, spendAdd = 0;

  const seasonName = ctx?.seasonName ?? "";
  const marketName = ctx?.marketName ?? "";
  const isFestival = /festival/i.test(seasonName);
  const isCompetitor = /aggressive/i.test(marketName) || /competitor/i.test(marketName);

  for (const d of decisions) {
    // ── Crisis 1: stock crisis ─────────────────────────────────────────────
    if (d.num === 1 && day >= 10) {
      if (d.optionKey === "a") {
        // Pause ads in affected state — lower revenue, lower spend
        revMult   *= 0.97;
        spendMult *= 0.92;
      } else if (d.optionKey === "b" && day >= 12) {
        // Continued despite stock-out: ROAS tanks
        revMult *= 0.60;
      } else if (d.optionKey === "c") {
        // Emergency restock: small revenue lift + spread ₹8K cost over days 10-14
        revMult *= 1.05;
        if (day >= 10 && day <= 14) spendAdd += 1_600; // ₹1,600/day × 5 days = ₹8,000
      }
    }

    // ── Crisis 2: category manager sell-through alert ─────────────────────
    if (d.num === 2 && day >= 19) {
      if (d.optionKey === "a" && day <= 23) revMult *= 1.12; // price-drop sales spike (5 days)
      else if (d.optionKey === "b") revMult *= 1.08;         // delist + hero redirect
      else if (d.optionKey === "c") revMult *= 1.15;         // SKU swap — best
      else if (d.optionKey === "d") revMult *= 1.02;         // extension: minimal effect
    }

    // ── Crisis 3: final-week strategic decision (day 25) ─────────────────
    // Crisis 3 fires at day 25; modifiers start at day 25 (not 26).
    // Effect depends on which SCENARIO TYPE the student is in.
    if (d.num === 3 && day >= 25) {
      if (isFestival) {
        // Options: a = front-load (days 25-27), b = steady, c = save for peak (days 28-30)
        if (d.optionKey === "a" && day <= 27) spendMult *= 1.25; // front-load blitz
        if (d.optionKey === "b") { /* steady spend: no modifier */ }
        if (d.optionKey === "c" && day >= 28) revMult *= 1.35;   // peak-day revenue spike
      } else if (isCompetitor) {
        // Options: a = match price (margin hit), b = double spend (ROAS drops), c = long-tail pivot
        if (d.optionKey === "a") { revMult *= 0.85; }             // price match → -15% ROAS
        if (d.optionKey === "b") { spendMult *= 1.40; revMult *= 0.65; } // double spend, bad ROAS
        if (d.optionKey === "c") { revMult *= 1.20; }             // long-tail → +20% efficiency
      } else {
        // Default: ranking push
        if (d.optionKey === "a") { spendMult *= 1.30; revMult *= 1.25; } // aggressive push → top 5 rank
        if (d.optionKey === "b") { revMult *= 1.10; }                    // moderate push → rank #8
        if (d.optionKey === "c") { /* maintain: no modifier */ }
      }
    }
  }
  return { spendMult, revMult, spendAdd };
}
