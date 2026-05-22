export interface SimEventOption {
  key: string;
  label: string;
  tokenCost: number;
  effect: string; // human-readable; engine doesn't yet apply numerically
}
export interface SimEvent {
  id: string;
  week: 2 | 3;
  emoji: string;
  title: string;
  body: (ctx: { topCity: string; topSku: string; daysLeft: number; budgetLeft: number }) => string;
  options: SimEventOption[];
}

export const WEEK2_EVENTS: SimEvent[] = [
  {
    id: "competitor_attack",
    week: 2,
    emoji: "⚔️",
    title: "Competitor Attack",
    body: ({ topCity }) =>
      `Competitor brand just launched a 25% off campaign on your top keyword. CPCs are up 35%. Your impressions in ${topCity} dropping by 20%.`,
    options: [
      { key: "long_tail", label: "Pivot to long-tail keywords", tokenCost: 1, effect: "Reduces CPC drag" },
      { key: "match_price", label: "Match price drop on hero SKU", tokenCost: 2, effect: "Costs margin, holds share" },
      { key: "ignore", label: "Hold steady, ride it out", tokenCost: 0, effect: "Lose share for 1 week" },
    ],
  },
  {
    id: "cm_threat",
    week: 2,
    emoji: "📞",
    title: "CM Threat",
    body: ({ topSku }) =>
      `Category Manager Rohit: "Your ${topSku} has only 12% sell-through in 25 days. We need that shelf space. What's your plan?"`,
    options: [
      { key: "drop_price", label: "Drop price 20%", tokenCost: 1, effect: "Lower margin, save shelf" },
      { key: "accept_delist", label: "Accept delist", tokenCost: 0, effect: "Free shelf for stronger SKU" },
      { key: "swap_sku", label: "Swap with better-performing SKU", tokenCost: 2, effect: "Reset shelf, lose data" },
    ],
  },
  {
    id: "stock_crisis",
    week: 2,
    emoji: "📦",
    title: "Stock Crisis",
    body: ({ topCity, topSku }) =>
      `URGENT: 3 dark stores in ${topCity} going OOS on ${topSku} in next 48 hours. They drove 40% of your sales.`,
    options: [
      { key: "express_po", label: "Express PO (2-day, +15% cost)", tokenCost: 2, effect: "Keeps top city alive" },
      { key: "direct_dispatch", label: "Direct Dispatch (1-day, +25% cost)", tokenCost: 3, effect: "Fastest, expensive" },
      { key: "let_oos", label: "Let them go OOS, focus elsewhere", tokenCost: 0, effect: "Save tokens, lose sales" },
    ],
  },
  {
    id: "cluster_opp",
    week: 2,
    emoji: "🎯",
    title: "Cluster Opportunity",
    body: ({ topSku }) =>
      `Pattern detected: Your ${topSku} is performing 3x better in 3 specific pin codes (gym-dense / premium zones).`,
    options: [
      { key: "cluster_bid", label: "Cluster zones, bid +30%", tokenCost: 1, effect: "Concentrate spend, higher ROAS" },
      { key: "cluster_daypart", label: "Cluster + dayparting to peak", tokenCost: 2, effect: "Maximum efficiency" },
      { key: "stay_broad", label: "Stay broad", tokenCost: 0, effect: "Miss the pattern" },
    ],
  },
];

export const WEEK3_EVENTS: SimEvent[] = [
  {
    id: "festival_spike",
    week: 3,
    emoji: "🎉",
    title: "Festival Spike",
    body: () => `Diwali in 5 days. Demand expected to spike 60% across categories. CPMs already up 25%.`,
    options: [
      { key: "front_load", label: "Front-load spend in next 5 days", tokenCost: 0, effect: "Capture spike, risk early burn" },
      { key: "save_powder", label: "Save powder for peak (Day 28-30)", tokenCost: 0, effect: "Cheaper CPMs later" },
      { key: "steady", label: "Maintain steady spend", tokenCost: 0, effect: "Balanced" },
    ],
  },
  {
    id: "ranking_opp",
    week: 3,
    emoji: "📈",
    title: "Ranking Opportunity",
    body: ({ topSku }) =>
      `Your ${topSku} currently #11 organic. With aggressive spend in next 7 days, top 5 is achievable.`,
    options: [
      { key: "push_hard", label: "Push hard (40% remaining budget)", tokenCost: 0, effect: "Could break into top 5" },
      { key: "moderate", label: "Moderate push", tokenCost: 0, effect: "Safer, smaller climb" },
      { key: "hold", label: "Stick with current strategy", tokenCost: 0, effect: "Stable" },
    ],
  },
  {
    id: "competitor_oos",
    week: 3,
    emoji: "🔥",
    title: "Competitor Stockout",
    body: ({ topCity }) =>
      `OPPORTUNITY: Your top competitor just stocked out in ${topCity}. You have a 3-day window to capture their share.`,
    options: [
      { key: "increase_bid", label: "Increase bid +40%, redirect budget", tokenCost: 2, effect: "Grab share fast" },
      { key: "partial", label: "Take partial advantage", tokenCost: 1, effect: "Safer move" },
      { key: "maintain", label: "Maintain current", tokenCost: 0, effect: "Miss the window" },
    ],
  },
  {
    id: "budget_check",
    week: 3,
    emoji: "💰",
    title: "Budget Reality Check",
    body: ({ daysLeft, budgetLeft }) =>
      `Status: You've got ₹${budgetLeft.toLocaleString("en-IN")} left with ${daysLeft} days remaining. Plan your final stretch.`,
    options: [
      { key: "frontload", label: "Frontload final week", tokenCost: 0, effect: "Burn now" },
      { key: "save", label: "Save for last-day push", tokenCost: 0, effect: "Bet on Day 28-30" },
      { key: "steady", label: "Maintain steady pace", tokenCost: 0, effect: "Balanced" },
    ],
  },
];

export function pickEvent(week: 2 | 3): SimEvent {
  const pool = week === 2 ? WEEK2_EVENTS : WEEK3_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
