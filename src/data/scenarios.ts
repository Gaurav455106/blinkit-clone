// Static data + deterministic scenario picker for the Blinkit simulator.

export type Velocity = "Very Low" | "Low" | "Medium" | "High";
export type Difficulty = "Medium" | "Hard" | "Very Hard";

export interface SKU {
  id: string;
  name: string;
  mrp: number;
  margin: number;
  velocity: Velocity;
}

export interface BrandProfile {
  id: string;
  name: string;
  emoji: string;
  category: string;
  difficulty: Difficulty;
  context: string;
  skus: SKU[];
  goodKeywords: string[];
  riskyKeywords: string[];
  optimalObjective: "performance" | "reach";
  optimalAdFormat: string;
  trap: string;
  cityContext: string;
  unitEconomics: string;
  relevantCategories: string[];
}

export const BRAND_PROFILES: BrandProfile[] = [
  {
    id: "henlo",
    name: "Henlo",
    emoji: "🐶",
    category: "Dog Treats",
    difficulty: "Medium",
    context:
      "Henlo is a 2-year-old D2C pet brand launching on Blinkit. Dog treats are their bestseller offline.",
    cityContext: "Bangalore",
    skus: [
      { id: "henlo-1", name: "Henlo Chicken Jerky Treats 150g", mrp: 299, margin: 15, velocity: "High" },
      { id: "henlo-2", name: "Henlo Dental Chews Pack of 10", mrp: 249, margin: 12, velocity: "High" },
      { id: "henlo-3", name: "Henlo Puppy Biscuits 200g", mrp: 199, margin: 10, velocity: "Medium" },
    ],
    goodKeywords: ["dog treats", "dental chews", "puppy snacks", "dog biscuits", "chicken jerky"],
    riskyKeywords: ["henlo", "dog food", "pet accessories"],
    optimalObjective: "performance",
    optimalAdFormat: "product_booster",
    trap: "Overstocking kills margin — ₹15 margin vanishes in 15 days of storage costs",
    unitEconomics: "Avg MRP ₹249 · Avg Margin ₹12 · High velocity hero SKU",
    relevantCategories: ["Dog Needs", "Pet Food & Accessories"],
  },
  {
    id: "glow",
    name: "Glow Republic",
    emoji: "✨",
    category: "Premium Skincare",
    difficulty: "Hard",
    context:
      "New D2C skincare brand. Zero presence on Blinkit. Customers don't search for Glow Republic yet — brand awareness is very low.",
    cityContext: "Delhi NCR",
    skus: [
      { id: "glow-1", name: "Glow Republic Vitamin C Serum 30ml", mrp: 799, margin: 180, velocity: "Medium" },
      { id: "glow-2", name: "Glow Republic SPF 50 Sunscreen 50g", mrp: 549, margin: 120, velocity: "Medium" },
      { id: "glow-3", name: "Glow Republic Retinol Night Cream 50ml", mrp: 999, margin: 220, velocity: "Low" },
    ],
    goodKeywords: ["vitamin c serum", "sunscreen spf 50", "retinol cream", "night cream", "face serum"],
    riskyKeywords: ["glow republic", "skincare routine", "beauty"],
    optimalObjective: "reach",
    optimalAdFormat: "listing_spotlight",
    trap: "Running Performance before Reach — no one searches your brand yet, CTR will be terrible and budget burns",
    unitEconomics: "Avg MRP ₹782 · Avg Margin ₹173 · Brand awareness is the bottleneck",
    relevantCategories: ["Beauty & Personal Care", "Skincare"],
  },
  {
    id: "vitaboost",
    name: "VitaBoost",
    emoji: "💊",
    category: "Health Supplements",
    difficulty: "Very Hard",
    context:
      "VitaBoost wants to pioneer the supplements category on Blinkit. No competitor has cracked it. Customers aren't trained to buy supplements in 10 minutes yet.",
    cityContext: "Mumbai",
    skus: [
      { id: "vita-1", name: "VitaBoost Multivitamin 60 tabs", mrp: 799, margin: 160, velocity: "Low" },
      { id: "vita-2", name: "VitaBoost Omega-3 30 caps", mrp: 599, margin: 120, velocity: "Low" },
      { id: "vita-3", name: "VitaBoost Iron + Folic 30 tabs", mrp: 499, margin: 100, velocity: "Low" },
    ],
    goodKeywords: ["multivitamin", "omega 3", "iron tablets", "folic acid", "vitamin c tablets"],
    riskyKeywords: ["vitaboost", "health supplements", "vitamins"],
    optimalObjective: "reach",
    optimalAdFormat: "listing_spotlight",
    trap: "Category barely exists on Blinkit — customers don't search supplements here, dead stock guaranteed",
    unitEconomics: "Avg MRP ₹632 · Avg Margin ₹126 · Category not trained yet",
    relevantCategories: ["Health & Wellness", "Supplements"],
  },
  {
    id: "tinybuddy",
    name: "TinyBuddy",
    emoji: "👶",
    category: "Baby Care",
    difficulty: "Hard",
    context:
      "TinyBuddy is a trusted offline baby brand entering Blinkit. Their customer is the new parent — highly specific, shops in the morning, very brand-loyal once converted.",
    cityContext: "Delhi NCR",
    skus: [
      { id: "tiny-1", name: "TinyBuddy Baby Wipes 80 pcs", mrp: 199, margin: 35, velocity: "Medium" },
      { id: "tiny-2", name: "TinyBuddy Diaper Rash Cream 50g", mrp: 299, margin: 60, velocity: "Medium" },
      { id: "tiny-3", name: "TinyBuddy Baby Shampoo 200ml", mrp: 249, margin: 50, velocity: "Low" },
    ],
    goodKeywords: ["baby wipes", "diaper cream", "baby shampoo", "rash cream", "baby essentials"],
    riskyKeywords: ["tinybuddy", "baby care", "parenting"],
    optimalObjective: "reach",
    optimalAdFormat: "brand_booster",
    trap: "Wrong dayparting — new parents shop 10AM-1PM, not 8-11PM. 24/7 ads waste budget on dead hours",
    unitEconomics: "Avg MRP ₹249 · Avg Margin ₹48 · Morning-only demand window",
    relevantCategories: ["Baby Care", "Mother & Baby"],
  },
  {
    id: "munchbox",
    name: "MunchBox",
    emoji: "🥨",
    category: "Packaged Snacks",
    difficulty: "Medium",
    context:
      "MunchBox makes healthy snacks. Launching on Blinkit. The category is brutally competitive — Haldirams, Lay's, Bingo all bidding aggressively on generic keywords.",
    cityContext: "Mumbai",
    skus: [
      { id: "munch-1", name: "MunchBox Roasted Makhana Peri Peri 60g", mrp: 149, margin: 18, velocity: "High" },
      { id: "munch-2", name: "MunchBox Multigrain Chips Tangy 50g", mrp: 49, margin: 5, velocity: "High" },
      { id: "munch-3", name: "MunchBox Mixed Nuts & Seeds 100g", mrp: 249, margin: 45, velocity: "Medium" },
    ],
    goodKeywords: ["makhana snacks", "roasted makhana", "healthy chips", "multigrain chips", "mixed nuts"],
    riskyKeywords: ["chips", "namkeen", "snacks"],
    optimalObjective: "performance",
    optimalAdFormat: "product_booster",
    trap: "Bidding on generic 'chips' puts you against Haldirams and Lay's. Niche keywords win here",
    unitEconomics: "Avg MRP ₹149 · Avg Margin ₹22 · Niche keywords beat generics",
    relevantCategories: ["Snacks", "Packaged Foods"],
  },
  {
    id: "pawlife",
    name: "PawLife",
    emoji: "🐾",
    category: "Pet Accessories",
    difficulty: "Hard",
    context:
      "PawLife makes premium pet accessories. Launching on Blinkit. These are considered purchases — a dog owner thinks before buying a harness, unlike dog treats.",
    cityContext: "Hyderabad",
    skus: [
      { id: "paw-1", name: "PawLife Adjustable Dog Leash 1.5m", mrp: 599, margin: 120, velocity: "Low" },
      { id: "paw-2", name: "PawLife Stainless Steel Dog Bowl Set", mrp: 499, margin: 100, velocity: "Low" },
      { id: "paw-3", name: "PawLife Dog Harness Medium", mrp: 799, margin: 160, velocity: "Very Low" },
    ],
    goodKeywords: ["dog leash", "dog bowl", "dog harness", "pet leash", "dog collar"],
    riskyKeywords: ["pet accessories", "dog products", "pawlife"],
    optimalObjective: "reach",
    optimalAdFormat: "recommendation_ads",
    trap: "Students assume pet accessories behave like pet food/treats. Nobody impulse-buys a dog leash in 10 minutes",
    unitEconomics: "Avg MRP ₹632 · Avg Margin ₹127 · Considered purchase, not impulse",
    relevantCategories: ["Pet Food & Accessories", "Dog Needs"],
  },
  {
    id: "fuelup",
    name: "FuelUp",
    emoji: "💪",
    category: "Protein & Fitness",
    difficulty: "Very Hard",
    context:
      "FuelUp is a premium protein brand. Launching on Blinkit. Customers are gym-goers concentrated in specific localities like Koramangala, Bandra, Jubilee Hills — not spread across the entire city.",
    cityContext: "Bangalore",
    skus: [
      { id: "fuel-1", name: "FuelUp Whey Protein Chocolate 500g", mrp: 1299, margin: 260, velocity: "Low" },
      { id: "fuel-2", name: "FuelUp Plant Protein Vanilla 400g", mrp: 999, margin: 200, velocity: "Very Low" },
      { id: "fuel-3", name: "FuelUp Protein Bar Choco Fudge 60g", mrp: 99, margin: 15, velocity: "Medium" },
    ],
    goodKeywords: ["whey protein", "protein supplement", "protein bar", "plant protein", "fitness supplement"],
    riskyKeywords: ["fuelup", "gym protein"],
    optimalObjective: "performance",
    optimalAdFormat: "product_booster",
    trap: "Pan India targeting burns budget. Demand is hyperlocal — only gym-dense pin codes like Koramangala, Bandra, Jubilee Hills",
    unitEconomics: "Avg MRP ₹799 · Avg Margin ₹158 · Hyperlocal demand",
    relevantCategories: ["Health & Wellness", "Sports Nutrition"],
  },
];

export const CITIES = ["Bangalore", "Delhi NCR", "Mumbai", "Hyderabad"];

export const SEASONS = [
  { name: "Summer Peak", note: "May–June, heatwave, hydration & cooling categories spike" },
  { name: "Monsoon", note: "July–September, slower foot traffic, comfort & immunity demand" },
  { name: "Festive", note: "October–November, gifting & celebrations, 2x average basket" },
  { name: "Winter", note: "December–January, skincare & warm food categories peak" },
  { name: "Off-Season", note: "February–April, baseline demand, normal velocity" },
];

export interface InventoryState {
  id: string;
  label: string;
  osa: number;
  fillRate: number;
  activeStores: number;
  agingUnits: number;
  tone: "critical" | "warning" | "healthy" | "overstocked";
}

export const INVENTORY_STATES: InventoryState[] = [
  { id: "critical", label: "Critical Stockout", osa: 54, fillRate: 62, activeStores: 22, agingUnits: 120, tone: "critical" },
  { id: "warning", label: "Patchy Coverage", osa: 71, fillRate: 78, activeStores: 38, agingUnits: 260, tone: "warning" },
  { id: "healthy", label: "Healthy Inventory", osa: 92, fillRate: 95, activeStores: 54, agingUnits: 80, tone: "healthy" },
  { id: "overstocked", label: "Overstocked", osa: 96, fillRate: 98, activeStores: 60, agingUnits: 1240, tone: "overstocked" },
];

export const MARKET_CONDITIONS = [
  { name: "Competitor Blitz", note: "A rival just slashed prices 20% across category" },
  { name: "Quiet Market", note: "Category demand is flat, no spike events on the horizon" },
  { name: "Viral Moment", note: "A category trend is going viral on Instagram this week" },
  { name: "Festive Surge", note: "Demand is up 40% across the platform, ad CPMs also rising" },
];

export interface CrisisOption {
  key: "a" | "b" | "c";
  label: string;
  points: number;
}
export interface Crisis {
  id: string;
  title: string;
  message: (city: string) => string;
  options: CrisisOption[];
}

export const CRISES: Crisis[] = [
  {
    id: "fill_rate",
    title: "Fill Rate Alert",
    message: (city) =>
      `Supply team flag: Fill rate dropped to 62% in South ${city} dark stores. 8 stores critically low.`,
    options: [
      { key: "a", label: "Pause ads in affected zones immediately", points: 10 },
      { key: "b", label: "Continue campaign, hope stock arrives", points: -5 },
      { key: "c", label: "Pause ads AND request emergency restock", points: 15 },
    ],
  },
  {
    id: "cm_alert",
    title: "Category Manager Alert",
    message: () =>
      `Blinkit CM: "Your top SKU has only 11% sell-through in 25 days. We need that shelf space."`,
    options: [
      { key: "a", label: "Drop price 20% to drive trial", points: 10 },
      { key: "b", label: "Accept delist, focus budget on better SKUs", points: 12 },
      { key: "c", label: "Fight to keep listing, promise to improve", points: 2 },
    ],
  },
  {
    id: "budget_stuck",
    title: "Budget Not Spending",
    message: () =>
      `Blinkit AM: "Your ₹2L campaign has only spent ₹18K in 5 days. Leadership is asking questions."`,
    options: [
      { key: "a", label: "Check inventory first — likely an OSA problem", points: 15 },
      { key: "b", label: "Increase bids to force ad delivery", points: -5 },
      { key: "c", label: "Widen targeting to broader audience", points: 2 },
    ],
  },
  {
    id: "cluster_oos",
    title: "Dark Store Cluster OOS",
    message: (city) =>
      `3 dark stores in central ${city} — your top demand area — just went out of stock. They drove 40% of orders.`,
    options: [
      { key: "a", label: "Pause campaign in that zone, redirect budget", points: 15 },
      { key: "b", label: "Keep campaign running across all zones", points: -10 },
      { key: "c", label: "Request emergency inter-store stock transfer", points: 10 },
    ],
  },
];

// --- Seeding helpers -------------------------------------------------------
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export interface Scenario {
  seed: string;
  profile: BrandProfile;
  city: string;
  season: typeof SEASONS[number];
  inventory: InventoryState;
  market: typeof MARKET_CONDITIONS[number];
  budget: number;
}

export function pickScenario(seed: string): Scenario {
  const h = djb2(seed.toLowerCase());
  const profile = BRAND_PROFILES[h % BRAND_PROFILES.length];
  const city = CITIES[Math.floor(h / 7) % CITIES.length];
  const season = SEASONS[Math.floor(h / 49) % SEASONS.length];
  const inventory = INVENTORY_STATES[Math.floor(h / 343) % INVENTORY_STATES.length];
  const market = MARKET_CONDITIONS[Math.floor(h / 2401) % MARKET_CONDITIONS.length];
  return { seed, profile, city, season, inventory, market, budget: 200000 };
}

export function pickCrisis(seed: string): Crisis {
  return CRISES[djb2(seed + "crisis") % CRISES.length];
}
