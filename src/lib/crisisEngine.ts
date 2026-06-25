/**
 * crisisEngine.ts — Budget-triggered crisis events with engine-pluggable effects
 *
 * Crises fire when cumulative spend crosses budget thresholds (not fixed days):
 *   Crisis 1 → 25% of ₹2L spent (₹50K)   — stock / supply
 *   Crisis 2 → 55% of ₹2L spent (₹1.1L)  — CM / SKU performance
 *   Crisis 3 → 80% of ₹2L spent (₹1.6L)  — strategic finish
 *
 * Each option carries an ActiveCrisisEffect that the engine applies for all
 * subsequent days. Effects are deterministic — no Math.random().
 *
 * Always 3 options: Best / Safe / Trap.
 * Scores:  Best=10, Safe=6, Trap=0  (scaled to crisis max in newScoring.ts)
 */

import type { Scenario } from "@/data/scenarios";
import type { ActiveCrisisEffect } from "@/lib/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrisisOptionFull {
  key:    "a" | "b" | "c";
  label:  string;
  effect: string;          // one-line summary shown to student
  score:  number;          // 10 / 6 / 0
  best?:  boolean;
  engineEffect: ActiveCrisisEffect;
}

export interface CrisisSpecFull {
  num:      1 | 2 | 3;
  icon:     string;
  title:    string;
  subtitle: string;
  tone:     "red" | "orange" | "blue";
  message:  string;
  options:  CrisisOptionFull[];
}

// ─── Null effect (used for safe/trap options that don't change the engine) ────

const NO_EFFECT = (num: 1 | 2 | 3): ActiveCrisisEffect => ({
  crisisNum: num, geoQualityMult: 1.0, cpmMult: 1.0, ctrMult: 1.0, stockDrainPerDay: 0,
});

// ─── Crisis builders ──────────────────────────────────────────────────────────

function buildCrisis1(scenario: Scenario): CrisisSpecFull {
  const topState = scenario.profile.primaryState;
  const heroSku  = scenario.profile.skus[0]?.name ?? "Hero SKU";
  const eventId  = scenario.scheduledCrisis?.eventId ?? "stock_crisis";

  if (eventId === "stock_crisis") {
    return {
      num: 1, icon: "🚨", tone: "red",
      title: "Supply Alert — Fill Rate Dropping",
      subtitle: `${topState} dark stores`,
      message: `Fill rate dropped to 62% in ${topState}. Your highest-performing dark stores are critically low on ${heroSku}. Ads are still running — but impressions are starting to under-deliver. You have a 48-hour window.`,
      options: [
        {
          key: "c", label: "Pause ads in affected state + request emergency restock", best: true,
          effect: `Ads pause in ${topState} for 2 days. Stock returns to 75% OSA. Resumes stronger.`,
          score: 10,
          engineEffect: {
            crisisNum: 1,
            geoQualityMult: 0.85,  // slight drag during restock window
            cpmMult: 1.0, ctrMult: 1.0, stockDrainPerDay: 0,
          },
        },
        {
          key: "a", label: "Pause ads in affected state immediately",
          effect: `Spend pauses in ${topState}. Budget shifts to other states.`,
          score: 6,
          engineEffect: {
            crisisNum: 1,
            geoQualityMult: 0.75,  // losing a full state
            cpmMult: 1.0, ctrMult: 1.0, stockDrainPerDay: 0,
          },
        },
        {
          key: "b", label: "Continue campaign and hope stock arrives",
          effect: `Stock runs out in ${topState} by Day +3. ROAS collapses there.`,
          score: 0,
          engineEffect: {
            crisisNum: 1,
            geoQualityMult: 0.5,   // stock crash wipes OSA in primary state
            cpmMult: 1.0, ctrMult: 0.9, stockDrainPerDay: 25,
          },
        },
      ],
    };
  }

  if (eventId === "competitor_attack") {
    return {
      num: 1, icon: "⚔️", tone: "red",
      title: "Competitor Bid Blitz",
      subtitle: `${scenario.profile.category} category`,
      message: `A competitor just launched an aggressive bidding campaign on your top keywords in ${topState}. Your CPCs jumped 35% in the last 6 hours. Current ROAS is slipping.`,
      options: [
        {
          key: "c", label: "Shift budget to long-tail keywords competitor isn't bidding on", best: true,
          effect: "Lower volume, but ROAS recovers. Less competition on niche terms.",
          score: 10,
          engineEffect: {
            crisisNum: 1,
            geoQualityMult: 1.0,
            cpmMult: 1.05,  // slight CPM drag from market pressure
            ctrMult: 1.1,   // better kw relevance on long-tail
            stockDrainPerDay: 0,
          },
        },
        {
          key: "a", label: "Match their bids — hold position",
          effect: "CPMs stay elevated but impressions hold. Expensive but visible.",
          score: 6,
          engineEffect: {
            crisisNum: 1,
            geoQualityMult: 1.0,
            cpmMult: 1.25,  // you're matching their bids
            ctrMult: 1.0, stockDrainPerDay: 0,
          },
        },
        {
          key: "b", label: "Double spend to outbid them",
          effect: "Massive CPM spike. ROAS drops sharply — you're in a bidding war.",
          score: 0,
          engineEffect: {
            crisisNum: 1,
            geoQualityMult: 1.0,
            cpmMult: 1.5,   // bidding war = very expensive
            ctrMult: 0.9, stockDrainPerDay: 0,
          },
        },
      ],
    };
  }

  // cluster_opp or cm_threat as Crisis 1
  return {
    num: 1, icon: "🔍", tone: "red",
    title: "Pin-Code Cluster Signal",
    subtitle: `${topState} performance spike`,
    message: `3 pin-code clusters in ${topState} are showing 4x the average ROAS — gym-dense, high-intent zones. Should you concentrate spend here?`,
    options: [
      {
        key: "c", label: "Shift 40% of budget to these 3 pin-code clusters", best: true,
        effect: "Concentrated spend in high-ROAS zones. Overall ROAS improves significantly.",
        score: 10,
        engineEffect: {
          crisisNum: 1,
          geoQualityMult: 1.15,  // concentrating in better zones
          cpmMult: 1.0, ctrMult: 1.15, stockDrainPerDay: 0,
        },
      },
      {
        key: "a", label: "Maintain current spread, monitor for a week",
        effect: "Safe but misses the opportunity window.",
        score: 6,
        engineEffect: { crisisNum: 1, geoQualityMult: 1.0, cpmMult: 1.0, ctrMult: 1.0, stockDrainPerDay: 0 },
      },
      {
        key: "b", label: "Ignore — these are probably anomalies",
        effect: "Cluster decays. You miss a high-ROAS window that won't reopen.",
        score: 0,
        engineEffect: { crisisNum: 1, geoQualityMult: 0.95, cpmMult: 1.0, ctrMult: 0.9, stockDrainPerDay: 0 },
      },
    ],
  };
}

function buildCrisis2(scenario: Scenario): CrisisSpecFull {
  const secondarySku = scenario.profile.skus[1]?.name ?? scenario.profile.skus[0]?.name ?? "SKU";
  const heroSku      = scenario.profile.skus[0]?.name ?? "Hero SKU";
  const eventId      = scenario.scheduledCrisis?.eventId ?? "cm_threat";

  if (eventId === "cm_threat") {
    return {
      num: 2, icon: "📞", tone: "orange",
      title: "Category Manager Warning",
      subtitle: "Shelf space under threat",
      message: `"Your ${secondarySku} has 14% sell-through — I have 3 other brands waiting for that shelf slot. Give me a plan in 24 hours or I'm pulling it."`,
      options: [
        {
          key: "c", label: `Swap in the higher-velocity ${heroSku} and concentrate ads there`, best: true,
          effect: `${secondarySku} replaced. Ads concentrate on ${heroSku} — sell-through jumps 60%.`,
          score: 10,
          engineEffect: {
            crisisNum: 2,
            geoQualityMult: 1.0,
            cpmMult: 1.0, ctrMult: 1.2,  // better SKU-format alignment
            stockDrainPerDay: 0,
          },
        },
        {
          key: "a", label: `Drop ${secondarySku} price by 20% to drive trial`,
          effect: "Sales spike 35% for 5 days but margin takes a hit.",
          score: 6,
          engineEffect: {
            crisisNum: 2,
            geoQualityMult: 1.0,
            cpmMult: 1.0, ctrMult: 1.1,
            stockDrainPerDay: 0,
          },
        },
        {
          key: "b", label: "Promise improvement, ask for a one-week extension",
          effect: "Buys time but nothing changes — CM pulls the listing at next check-in.",
          score: 0,
          engineEffect: {
            crisisNum: 2,
            geoQualityMult: 0.85,  // listing uncertainty reduces delivery
            cpmMult: 1.0, ctrMult: 0.85, stockDrainPerDay: 0,
          },
        },
      ],
    };
  }

  // competitor_attack or stock_crisis as Crisis 2
  return {
    num: 2, icon: "📊", tone: "orange",
    title: "Mid-Run Performance Review",
    subtitle: "Category Manager check-in",
    message: `You're at the halfway point. ${heroSku} is performing but ${secondarySku} is dragging down your overall ROAS. The CM wants to see a correction plan.`,
    options: [
      {
        key: "c", label: `Pause ${secondarySku} campaigns, double down on ${heroSku}`, best: true,
        effect: "ROAS improves as budget concentrates on the stronger SKU.",
        score: 10,
        engineEffect: {
          crisisNum: 2,
          geoQualityMult: 1.0,
          cpmMult: 1.0, ctrMult: 1.15,
          stockDrainPerDay: 0,
        },
      },
      {
        key: "a", label: "Reduce ${secondarySku} budget by 50%, keep it live",
        effect: "Partial improvement — ${secondarySku} stops burning, but still underperforms.",
        score: 6,
        engineEffect: {
          crisisNum: 2,
          geoQualityMult: 1.0,
          cpmMult: 1.0, ctrMult: 1.05,
          stockDrainPerDay: 0,
        },
      },
      {
        key: "b", label: "Stay the course — it will improve",
        effect: "It doesn't. ${secondarySku} continues to drag ROAS for the rest of the run.",
        score: 0,
        engineEffect: {
          crisisNum: 2,
          geoQualityMult: 1.0,
          cpmMult: 1.0, ctrMult: 0.85,
          stockDrainPerDay: 0,
        },
      },
    ],
  };
}

function buildCrisis3(scenario: Scenario): CrisisSpecFull {
  const season   = scenario.season.name;
  const market   = scenario.market.name;
  const heroSku  = scenario.profile.skus[0]?.name ?? "Hero SKU";

  if (/festival/i.test(season)) {
    return {
      num: 3, icon: "⚡", tone: "blue",
      title: "Festival Surge — Final 5 Days",
      subtitle: "Demand spike incoming",
      message: `Festival is 5 days away. Demand expected to spike 60%. CPMs are rising fast — but peak-day conversions could be 2x normal. How do you allocate your final remaining budget?`,
      options: [
        {
          key: "c", label: "Save 50% of remaining budget for the 3 peak days", best: true,
          effect: "+35% revenue on peak days. Maximum return on final spend.",
          score: 10,
          engineEffect: {
            crisisNum: 3,
            geoQualityMult: 1.0,
            cpmMult: 0.9,  // saving for peak = better CPM timing
            ctrMult: 1.25, // peak demand multiplier
            stockDrainPerDay: 0,
          },
        },
        {
          key: "a", label: "Front-load all remaining budget in the next 3 days",
          effect: "High visibility pre-peak but budget may exhaust before peak day.",
          score: 6,
          engineEffect: {
            crisisNum: 3,
            geoQualityMult: 1.0,
            cpmMult: 1.15,  // pre-peak CPM already rising
            ctrMult: 1.05,
            stockDrainPerDay: 0,
          },
        },
        {
          key: "b", label: "Maintain steady spend, let the wave carry you",
          effect: "Consistent but you miss the peak-day multiplier.",
          score: 0,
          engineEffect: {
            crisisNum: 3,
            geoQualityMult: 1.0,
            cpmMult: 1.25,  // paying festival CPMs without peak CTR payoff
            ctrMult: 1.0,
            stockDrainPerDay: 0,
          },
        },
      ],
    };
  }

  if (/aggressive/i.test(market) || /competitor/i.test(market)) {
    return {
      num: 3, icon: "⚡", tone: "blue",
      title: "Competitor Price Cut — Final Week",
      subtitle: "Conversion rate falling",
      message: `Your top competitor just slashed prices 22%. Your conversion rate dropped 35% in the last 4 hours. You have your final remaining budget — what's the move?`,
      options: [
        {
          key: "c", label: "Pivot to long-tail keywords the competitor isn't bidding on",
          best: true,
          effect: "Lower volume but ROAS recovers. +20% efficiency on final spend.",
          score: 10,
          engineEffect: {
            crisisNum: 3,
            geoQualityMult: 1.0,
            cpmMult: 0.9,   // less contested keywords
            ctrMult: 1.15,
            stockDrainPerDay: 0,
          },
        },
        {
          key: "a", label: "Match their price — stop the ROAS bleed",
          effect: "Conversions stabilise but margin takes a 20% hit.",
          score: 6,
          engineEffect: {
            crisisNum: 3,
            geoQualityMult: 1.0,
            cpmMult: 1.0,
            ctrMult: 1.05,
            stockDrainPerDay: 0,
          },
        },
        {
          key: "b", label: "Double ad spend to out-shout them",
          effect: "Bidding war. CPMs spike 50%. ROAS drops further.",
          score: 0,
          engineEffect: {
            crisisNum: 3,
            geoQualityMult: 1.0,
            cpmMult: 1.5,
            ctrMult: 0.9,
            stockDrainPerDay: 0,
          },
        },
      ],
    };
  }

  // Default: organic ranking opportunity
  return {
    num: 3, icon: "⚡", tone: "blue",
    title: "Organic Rank Push — Final Stretch",
    subtitle: `${heroSku} at rank #11`,
    message: `${heroSku} is sitting at organic rank #11. With an aggressive final push, top-5 is achievable — and top-5 rankings compound after the campaign ends. How do you close out?`,
    options: [
      {
        key: "a", label: `Push hard — 40% of remaining budget on ${heroSku} in top states`, best: true,
        effect: "Achieves top-5 rank. Sales sustain post-campaign.",
        score: 10,
        engineEffect: {
          crisisNum: 3,
          geoQualityMult: 1.1,   // concentrated, high-stock states
          cpmMult: 1.0,
          ctrMult: 1.2,          // rank momentum boosts CTR
          stockDrainPerDay: 0,
        },
      },
      {
        key: "b", label: "Moderate push — balanced spend across all campaigns",
        effect: "Reaches rank #8. Modest gain, no post-campaign lift.",
        score: 6,
        engineEffect: {
          crisisNum: 3,
          geoQualityMult: 1.0,
          cpmMult: 1.0, ctrMult: 1.05,
          stockDrainPerDay: 0,
        },
      },
      {
        key: "c", label: "Hold current spend — let organic growth happen naturally",
        effect: "Rank stays at #11. No improvement.",
        score: 0,
        engineEffect: {
          crisisNum: 3,
          geoQualityMult: 1.0,
          cpmMult: 1.0, ctrMult: 0.95,
          stockDrainPerDay: 0,
        },
      },
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCrisisFull(num: 1 | 2 | 3, scenario: Scenario): CrisisSpecFull {
  if (num === 1) return buildCrisis1(scenario);
  if (num === 2) return buildCrisis2(scenario);
  return buildCrisis3(scenario);
}

/**
 * Extract the ActiveCrisisEffect for a resolved crisis option.
 * This is what gets stored in SimContext and fed back into computeDay().
 */
export function getEffectForOption(
  crisis: CrisisSpecFull,
  optionKey: string,
): ActiveCrisisEffect {
  const opt = crisis.options.find(o => o.key === optionKey);
  return opt?.engineEffect ?? NO_EFFECT(crisis.num);
}

/**
 * Get max possible score for a crisis (always 10 — for scaling in newScoring.ts).
 */
export function getMaxCrisisOptionScore(): number {
  return 10;
}
