// Static data + scenario generator for the Blinkit simulator.
// NOTE: "city*" identifiers are kept for back-compat — they now hold STATE-level data.
// Real Blinkit only offers Pan India OR Select States as targeting granularity.

export type Velocity = "Very Low" | "Low" | "Medium" | "High";
export type Difficulty = "Medium" | "Hard" | "Very Hard";
export type GoalType = "ROAS-First" | "Awareness-First" | "Category-Creation" | "Volume-First" | "Inventory-Clearance";

// ─── Offline presence (Modern Trade / General Trade sell-through signal) ──────
export type OfflinePresence = "strong" | "moderate" | "weak" | "none";

export interface StatePresenceMap {
  /** Brand-level base presence by state. Unlisted states default to "none". */
  base: Partial<Record<StateName, OfflinePresence>>;
  /** Per-SKU overrides — only specify states that differ from base. Keyed by SKU id. */
  skuOverrides?: Record<string, Partial<Record<StateName, OfflinePresence>>>;
}

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
  goalType: GoalType;
  primaryState: StateName;
  secondaryStates: StateName[];
  peakHours: string; // human-readable hint
  statePresence?: StatePresenceMap;
}

// ─── 23 Blinkit-operational states ─────────────────────────────────────────
export const BLINKIT_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha",
  "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
] as const;
export type StateName = typeof BLINKIT_STATES[number];

// State → cities with dark-store counts (internal drilldown only).
// Covers tier-1 and tier-2 cities for every operational state so the
// campaign builder's city picker has real options everywhere.
export const STATE_TO_CITIES: Partial<Record<StateName, { name: string; stores: number }[]>> = {
  "Andhra Pradesh": [
    { name: "Visakhapatnam", stores: 18 }, { name: "Vijayawada", stores: 12 }, { name: "Guntur", stores: 6 },
  ],
  Assam: [
    { name: "Guwahati", stores: 14 }, { name: "Dibrugarh", stores: 4 },
  ],
  Bihar: [
    { name: "Patna", stores: 16 }, { name: "Gaya", stores: 5 }, { name: "Muzaffarpur", stores: 4 },
  ],
  Chhattisgarh: [
    { name: "Raipur", stores: 10 }, { name: "Bhilai", stores: 5 },
  ],
  Delhi: [
    { name: "Delhi NCR", stores: 55 },
  ],
  Goa: [
    { name: "Panaji", stores: 6 }, { name: "Margao", stores: 4 },
  ],
  Gujarat: [
    { name: "Ahmedabad", stores: 18 }, { name: "Surat", stores: 12 }, { name: "Vadodara", stores: 8 }, { name: "Rajkot", stores: 6 },
  ],
  Haryana: [
    { name: "Gurgaon", stores: 15 }, { name: "Faridabad", stores: 9 }, { name: "Panipat", stores: 4 },
  ],
  "Himachal Pradesh": [
    { name: "Shimla", stores: 5 }, { name: "Dharamshala", stores: 3 },
  ],
  "Jammu & Kashmir": [
    { name: "Srinagar", stores: 6 }, { name: "Jammu", stores: 5 },
  ],
  Jharkhand: [
    { name: "Ranchi", stores: 8 }, { name: "Jamshedpur", stores: 6 },
  ],
  Karnataka: [
    { name: "Bangalore", stores: 40 }, { name: "Mysore", stores: 8 }, { name: "Hubballi", stores: 5 },
  ],
  Kerala: [
    { name: "Kochi", stores: 10 }, { name: "Thiruvananthapuram", stores: 7 }, { name: "Kozhikode", stores: 5 },
  ],
  "Madhya Pradesh": [
    { name: "Indore", stores: 14 }, { name: "Bhopal", stores: 10 }, { name: "Jabalpur", stores: 6 },
  ],
  Maharashtra: [
    { name: "Mumbai", stores: 48 }, { name: "Pune", stores: 15 }, { name: "Nagpur", stores: 7 }, { name: "Nashik", stores: 6 },
  ],
  Odisha: [
    { name: "Bhubaneswar", stores: 9 }, { name: "Cuttack", stores: 5 },
  ],
  Punjab: [
    { name: "Ludhiana", stores: 8 }, { name: "Amritsar", stores: 6 }, { name: "Jalandhar", stores: 4 },
  ],
  Rajasthan: [
    { name: "Jaipur", stores: 15 }, { name: "Jodhpur", stores: 6 }, { name: "Udaipur", stores: 4 },
  ],
  "Tamil Nadu": [
    { name: "Chennai", stores: 25 }, { name: "Coimbatore", stores: 10 }, { name: "Madurai", stores: 6 },
  ],
  Telangana: [
    { name: "Hyderabad", stores: 28 }, { name: "Warangal", stores: 5 },
  ],
  "Uttar Pradesh": [
    { name: "Noida", stores: 18 }, { name: "Lucknow", stores: 14 }, { name: "Kanpur", stores: 8 }, { name: "Varanasi", stores: 6 }, { name: "Agra", stores: 5 },
  ],
  Uttarakhand: [
    { name: "Dehradun", stores: 6 }, { name: "Haridwar", stores: 3 },
  ],
  "West Bengal": [
    { name: "Kolkata", stores: 20 }, { name: "Siliguri", stores: 5 }, { name: "Durgapur", stores: 3 },
  ],
};

// Back-compat alias: CityName is now a state name everywhere in the codebase.
export type CityName = StateName;
export const CITIES = BLINKIT_STATES;

export const CITY_STORE_COUNT: Record<CityName, number> = BLINKIT_STATES.reduce((acc, s) => {
  acc[s] = (STATE_TO_CITIES[s] ?? []).reduce((sum, c) => sum + c.stores, 0);
  return acc;
}, {} as Record<CityName, number>);

// Legacy export (unused — kept for back-compat)
export const CITY_TO_CHILDREN: Partial<Record<CityName, string[]>> = Object.fromEntries(
  Object.entries(STATE_TO_CITIES).map(([s, cities]) => [s, (cities ?? []).map((c) => c.name)])
);

export const BRAND_PROFILES: BrandProfile[] = [
  {
    id: "henlo", name: "Henlo", emoji: "🐾", category: "Dog Treats", difficulty: "Medium",
    context: "Henlo is a 2-year-old D2C pet brand launching on Blinkit. Dog treats are their bestseller offline.",
    cityContext: "Karnataka",
    primaryState: "Karnataka", secondaryStates: ["Maharashtra", "Telangana"],
    peakHours: "Pet owners typically shop 7-10 AM and 6-9 PM. Consider these peak windows.",
    skus: [
      { id: "henlo-1", name: "Henlo Chicken Jerky Treats 150g", mrp: 299, margin: 15, velocity: "High" },
      { id: "henlo-2", name: "Henlo Dental Chews Pack of 10", mrp: 249, margin: 12, velocity: "High" },
      { id: "henlo-3", name: "Henlo Puppy Biscuits 200g", mrp: 199, margin: 10, velocity: "Medium" },
    ],
    goodKeywords: ["dog treats", "dental chews", "puppy snacks", "dog biscuits", "chicken jerky"],
    riskyKeywords: ["henlo", "dog food", "pet accessories"],
    optimalObjective: "performance", optimalAdFormat: "product_booster",
    trap: "Overstocking kills margin — ₹15 margin vanishes in 15 days of storage costs",
    unitEconomics: "Avg MRP ₹249 · Avg Margin ₹12 · High velocity hero SKU",
    relevantCategories: ["Dog Needs", "Pet Food & Accessories"],
    goalType: "ROAS-First",
    statePresence: {
      base: { Karnataka: "strong", Maharashtra: "moderate", Telangana: "moderate", Delhi: "moderate", Gujarat: "moderate", "Tamil Nadu": "weak", "West Bengal": "weak", Haryana: "weak", Kerala: "weak", Punjab: "weak", Rajasthan: "weak" },
      skuOverrides: { "henlo-3": { Karnataka: "moderate", Maharashtra: "weak" } },
    },
  },
  {
    id: "glow", name: "Glow Republic", emoji: "✨", category: "Premium Skincare", difficulty: "Hard",
    context: "New D2C skincare brand. Zero presence on Blinkit. Customers don't search for Glow Republic yet — brand awareness is very low.",
    cityContext: "Maharashtra",
    primaryState: "Maharashtra", secondaryStates: ["Delhi", "Karnataka"],
    peakHours: "Premium skincare buyers shop 8-11 AM and 7-10 PM.",
    skus: [
      { id: "glow-1", name: "Glow Republic Vitamin C Serum 30ml", mrp: 799, margin: 180, velocity: "Medium" },
      { id: "glow-2", name: "Glow Republic SPF 50 Sunscreen 50g", mrp: 549, margin: 120, velocity: "Medium" },
      { id: "glow-3", name: "Glow Republic Retinol Night Cream 50ml", mrp: 999, margin: 220, velocity: "Low" },
    ],
    goodKeywords: ["vitamin c serum", "sunscreen spf 50", "retinol cream", "night cream", "face serum"],
    riskyKeywords: ["glow republic", "skincare routine", "beauty"],
    optimalObjective: "reach", optimalAdFormat: "listing_spotlight",
    trap: "Running Performance before Reach — no one searches your brand yet, CTR will be terrible and budget burns",
    unitEconomics: "Avg MRP ₹782 · Avg Margin ₹173 · Brand awareness is the bottleneck",
    relevantCategories: ["Beauty & Personal Care", "Skincare"],
    goalType: "Awareness-First",
    statePresence: {
      base: { Maharashtra: "strong", Delhi: "moderate", Karnataka: "moderate", "Tamil Nadu": "weak", Telangana: "weak", Gujarat: "weak" },
      skuOverrides: { "glow-3": { Maharashtra: "moderate", Delhi: "weak", Karnataka: "none" } },
    },
  },
  {
    id: "vitaboost", name: "VitaBoost", emoji: "💊", category: "Health Supplements", difficulty: "Very Hard",
    context: "VitaBoost wants to pioneer the supplements category on Blinkit. No competitor has cracked it. Customers aren't trained to buy supplements in 10 minutes yet.",
    cityContext: "Maharashtra",
    primaryState: "Maharashtra", secondaryStates: ["Karnataka", "Telangana"],
    peakHours: "Health-conscious customers shop 6-9 AM.",
    skus: [
      { id: "vita-1", name: "VitaBoost Multivitamin 60 tabs", mrp: 799, margin: 160, velocity: "Low" },
      { id: "vita-2", name: "VitaBoost Omega-3 30 caps", mrp: 599, margin: 120, velocity: "Low" },
      { id: "vita-3", name: "VitaBoost Iron + Folic 30 tabs", mrp: 499, margin: 100, velocity: "Low" },
    ],
    goodKeywords: ["multivitamin", "omega 3", "iron tablets", "folic acid", "vitamin c tablets"],
    riskyKeywords: ["vitaboost", "health supplements", "vitamins"],
    optimalObjective: "reach", optimalAdFormat: "listing_spotlight",
    trap: "Category barely exists on Blinkit — customers don't search supplements here, dead stock guaranteed",
    unitEconomics: "Avg MRP ₹632 · Avg Margin ₹126 · Category not trained yet",
    relevantCategories: ["Health & Wellness", "Supplements"],
    goalType: "Category-Creation",
    statePresence: {
      base: { Maharashtra: "moderate", Karnataka: "moderate", Delhi: "moderate", Telangana: "weak", "Tamil Nadu": "weak", Gujarat: "weak", "West Bengal": "weak" },
      skuOverrides: { "vita-3": { Maharashtra: "strong", Delhi: "moderate", Karnataka: "moderate" } },
    },
  },
  {
    id: "tinybuddy", name: "TinyBuddy", emoji: "👶", category: "Baby Care", difficulty: "Hard",
    context: "TinyBuddy is a trusted offline baby brand entering Blinkit. Their customer is the new parent — highly specific, shops in the morning, very brand-loyal once converted.",
    cityContext: "Delhi",
    primaryState: "Delhi", secondaryStates: ["Haryana", "Uttar Pradesh"],
    peakHours: "New parents shop 9 AM-1 PM, not evening hours.",
    skus: [
      { id: "tiny-1", name: "TinyBuddy Baby Wipes 80 pcs", mrp: 199, margin: 35, velocity: "Medium" },
      { id: "tiny-2", name: "TinyBuddy Diaper Rash Cream 50g", mrp: 299, margin: 60, velocity: "Medium" },
      { id: "tiny-3", name: "TinyBuddy Baby Shampoo 200ml", mrp: 249, margin: 50, velocity: "Low" },
    ],
    goodKeywords: ["baby wipes", "diaper cream", "baby shampoo", "rash cream", "baby essentials"],
    riskyKeywords: ["tinybuddy", "baby care", "parenting"],
    optimalObjective: "reach", optimalAdFormat: "brand_booster",
    trap: "Wrong dayparting — new parents shop 10AM-1PM, not 8-11PM. 24/7 ads waste budget on dead hours",
    unitEconomics: "Avg MRP ₹249 · Avg Margin ₹48 · Morning-only demand window",
    relevantCategories: ["Baby Care", "Mother & Baby"],
    goalType: "Volume-First",
    statePresence: {
      base: { Delhi: "strong", Haryana: "strong", "Uttar Pradesh": "strong", Maharashtra: "moderate", Gujarat: "moderate", Punjab: "moderate", Rajasthan: "moderate", "West Bengal": "moderate", Karnataka: "weak", "Tamil Nadu": "weak", Telangana: "weak" },
      skuOverrides: { "tiny-3": { Delhi: "moderate", "Uttar Pradesh": "moderate", Haryana: "moderate" } },
    },
  },
  {
    id: "munchbox", name: "MunchBox", emoji: "🍿", category: "Packaged Snacks", difficulty: "Medium",
    context: "MunchBox makes healthy snacks. Launching on Blinkit. The category is brutally competitive — Haldirams, Lay's, Bingo all bidding aggressively on generic keywords.",
    cityContext: "Maharashtra",
    primaryState: "Maharashtra", secondaryStates: ["Gujarat", "Karnataka"],
    peakHours: "Snack purchases peak 5 PM-10 PM.",
    skus: [
      { id: "munch-1", name: "MunchBox Roasted Makhana Peri Peri 60g", mrp: 149, margin: 18, velocity: "High" },
      { id: "munch-2", name: "MunchBox Multigrain Chips Tangy 50g", mrp: 49, margin: 5, velocity: "High" },
      { id: "munch-3", name: "MunchBox Mixed Nuts & Seeds 100g", mrp: 249, margin: 45, velocity: "Medium" },
    ],
    goodKeywords: ["makhana snacks", "roasted makhana", "healthy chips", "multigrain chips", "mixed nuts"],
    riskyKeywords: ["chips", "namkeen", "snacks"],
    optimalObjective: "performance", optimalAdFormat: "product_booster",
    trap: "Bidding on generic 'chips' puts you against Haldirams and Lay's. Niche keywords win here",
    unitEconomics: "Avg MRP ₹149 · Avg Margin ₹22 · Niche keywords beat generics",
    relevantCategories: ["Snacks", "Packaged Foods"],
    goalType: "ROAS-First",
    statePresence: {
      base: { Maharashtra: "strong", Gujarat: "moderate", Karnataka: "moderate", Delhi: "moderate", "Tamil Nadu": "moderate", "West Bengal": "moderate", Rajasthan: "weak", Punjab: "weak", "Uttar Pradesh": "weak", Haryana: "weak" },
      skuOverrides: { "munch-2": { Maharashtra: "strong", Gujarat: "strong", "Uttar Pradesh": "moderate", Delhi: "moderate" } },
    },
  },
  {
    id: "pawlife", name: "PawLife", emoji: "🦮", category: "Pet Accessories", difficulty: "Hard",
    context: "PawLife makes premium pet accessories. Launching on Blinkit. These are considered purchases — a dog owner thinks before buying a harness, unlike dog treats.",
    cityContext: "Telangana",
    primaryState: "Telangana", secondaryStates: ["Karnataka", "Maharashtra"],
    peakHours: "Considered purchases happen 10 AM-6 PM.",
    skus: [
      { id: "paw-1", name: "PawLife Adjustable Dog Leash 1.5m", mrp: 599, margin: 120, velocity: "Low" },
      { id: "paw-2", name: "PawLife Stainless Steel Dog Bowl Set", mrp: 499, margin: 100, velocity: "Low" },
      { id: "paw-3", name: "PawLife Dog Harness Medium", mrp: 799, margin: 160, velocity: "Very Low" },
    ],
    goodKeywords: ["dog leash", "dog bowl", "dog harness", "pet leash", "dog collar"],
    riskyKeywords: ["pet accessories", "dog products", "pawlife"],
    optimalObjective: "reach", optimalAdFormat: "recommendation_ads",
    trap: "Students assume pet accessories behave like pet food/treats. Nobody impulse-buys a dog leash in 10 minutes",
    unitEconomics: "Avg MRP ₹632 · Avg Margin ₹127 · Considered purchase, not impulse",
    relevantCategories: ["Pet Food & Accessories", "Dog Needs"],
    goalType: "Awareness-First",
    statePresence: {
      base: { Telangana: "moderate", Karnataka: "moderate", Maharashtra: "moderate", Delhi: "weak", "Tamil Nadu": "weak", Gujarat: "weak", "West Bengal": "weak" },
    },
  },
  {
    id: "fuelup", name: "FuelUp", emoji: "💪", category: "Protein & Fitness", difficulty: "Very Hard",
    context: "FuelUp is a premium protein brand. Launching on Blinkit. Customers are gym-goers concentrated in metros — demand is hyperlocal, not spread across India.",
    cityContext: "Karnataka",
    primaryState: "Karnataka", secondaryStates: ["Maharashtra", "Delhi"],
    peakHours: "Gym-goers shop 5-8 AM (pre-workout) and 6-9 PM (post-workout).",
    skus: [
      { id: "fuel-1", name: "FuelUp Whey Protein Chocolate 500g", mrp: 1299, margin: 260, velocity: "Low" },
      { id: "fuel-2", name: "FuelUp Plant Protein Vanilla 400g", mrp: 999, margin: 200, velocity: "Very Low" },
      { id: "fuel-3", name: "FuelUp Protein Bar Choco Fudge 60g", mrp: 99, margin: 15, velocity: "Medium" },
    ],
    goodKeywords: ["whey protein", "protein supplement", "protein bar", "plant protein", "fitness supplement"],
    riskyKeywords: ["fuelup", "gym protein"],
    optimalObjective: "performance", optimalAdFormat: "product_booster",
    trap: "Pan India targeting burns budget. Demand is hyperlocal — concentrated in metros only",
    unitEconomics: "Avg MRP ₹799 · Avg Margin ₹158 · Hyperlocal demand",
    relevantCategories: ["Health & Wellness", "Sports Nutrition"],
    goalType: "ROAS-First",
    statePresence: {
      base: { Karnataka: "strong", Maharashtra: "strong", Delhi: "moderate", Telangana: "moderate", "Tamil Nadu": "moderate", Gujarat: "weak", "West Bengal": "weak", Haryana: "weak" },
      skuOverrides: {
        "fuel-2": { Karnataka: "moderate", Maharashtra: "moderate", Delhi: "weak" },
        "fuel-3": { Karnataka: "strong", Maharashtra: "strong", Delhi: "moderate", Telangana: "moderate" },
      },
    },
  },
];

export const SEASONS = [
  { name: "Normal Week", note: "Baseline demand, no spikes.", implication: "Stable CPMs. Standard bids work — focus on efficiency over aggressive spend." },
  { name: "Festival Surge", note: "Diwali/Holi — demand +40%, CPMs +30%.", implication: "CPMs are rising fast. Front-load budget in Week 1 before rates peak. Higher demand means more conversions — but only if you're stocked." },
  { name: "Post-Festival Slowdown", note: "Demand -40%, careful with spend.", implication: "Demand is low. Reduce daily caps, don't overspend. Prioritise efficiency over scale this month." },
  { name: "Summer Season", note: "Skincare/beverage spike.", implication: "Category demand is spiking. Double down on your top SKU — this is not the time to spread budget thin." },
  { name: "New Year Health Spike", note: "Supplements/protein boom.", implication: "Health searches are surging. Aggressive keyword bidding will pay off — but only if your category is relevant." },
] as const;

export const MARKET_CONDITIONS = [
  { name: "Stable Market", note: "No major competitor moves.", implication: "No unusual pressure. Run your plan as designed." },
  { name: "Aggressive Competitor", note: "CPMs +35%.", implication: "You need 25–35% higher bids to hold impression share. Narrow your geo to conserve budget for stocked states." },
  { name: "Price War in Category", note: "Margins squeezed across the shelf.", implication: "Don't chase ROAS — margins are thin. Focus on sell-through volume instead." },
  { name: "New Entrant Disrupting", note: "A new brand is buying share aggressively.", implication: "Defend your shelf. Consider Listing Spotlight to hold visibility while the new entrant burns budget on generic terms." },
  { name: "Platform Pushing Private Label", note: "Blinkit pushing its own label in your category.", implication: "Platform will favour its own SKUs in organic ranking. You need a strong CM pitch and above-average bids to compete." },
] as const;

export const INVENTORY_STATE_LABELS = ["Healthy", "Shaky", "Critical", "Overstocked"] as const;
export type InventoryStateLabel = typeof INVENTORY_STATE_LABELS[number];

export interface InventoryState {
  id: string;
  label: InventoryStateLabel;
  osa: number;
  fillRate: number;
  activeStores: number;
  agingUnits: number;
  tone: "critical" | "warning" | "healthy" | "overstocked";
}

export type CityStockMap = Record<CityName, number>;

export type BrandLifecycle = "Acquire" | "Convert" | "Retain";

export interface GoalMetric { label: string; target: number; unit: string }

export interface ClientGoals {
  primary: string;
  /** Goals that require conversion-type campaigns (product_booster, recommendation_ads) */
  performanceGoals: GoalMetric[];
  /** Goals that require awareness-type campaigns (listing_spotlight, brand_booster, stories) */
  reachGoals: GoalMetric[];
  /** Convenience union used by the scoring engine */
  metrics: GoalMetric[];
  threshold: string;
  /** Where this brand sits in the customer journey */
  lifecycle: BrandLifecycle;
  /** One-line strategic hint for students about what campaign mix to build */
  campaignHint: string;
}

export interface ScheduledCrisis {
  day: number;
  eventId: string;
  reason: string;
}
export const SCHEDULED_CRISIS_BY_PROFILE: Record<string, ScheduledCrisis> = {
  henlo: { day: 12, eventId: "stock_crisis", reason: "High-velocity SKU runs dry mid-flight" },
  glow: { day: 10, eventId: "competitor_attack", reason: "Established skincare brand counter-attacks" },
  vitaboost: { day: 14, eventId: "cm_threat", reason: "CM threatens to delist slow category" },
  tinybuddy: { day: 9, eventId: "cluster_opp", reason: "Morning-shopper cluster surfaces fast" },
  munchbox: { day: 11, eventId: "competitor_attack", reason: "Haldirams launches counter-bid blitz" },
  pawlife: { day: 18, eventId: "cm_threat", reason: "Low sell-through on considered purchases" },
  fuelup: { day: 8, eventId: "cluster_opp", reason: "Gym-dense pin codes outperform 4x" },
};

export interface Scenario {
  seed: string;
  profile: BrandProfile;
  cityStockMap: CityStockMap; // now keyed by STATE name
  season: typeof SEASONS[number];
  market: typeof MARKET_CONDITIONS[number];
  inventory: InventoryState;
  budget: number;
  clientGoals: ClientGoals;
  scheduledCrisis: ScheduledCrisis;
  city: CityName; // legacy: top-OSA state
}

export interface CrisisOption { key: "a" | "b" | "c"; label: string; points: number }
export interface Crisis {
  id: string; title: string;
  message: (city: string) => string;
  options: CrisisOption[];
}
export const CRISES: Crisis[] = [
  {
    id: "fill_rate", title: "Fill Rate Alert",
    message: (city) => `Supply team flag: Fill rate dropped to 62% in South ${city} dark stores. 8 stores critically low.`,
    options: [
      { key: "a", label: "Pause ads in affected zones immediately", points: 10 },
      { key: "b", label: "Continue campaign, hope stock arrives", points: -5 },
      { key: "c", label: "Pause ads AND request emergency restock", points: 15 },
    ],
  },
];
export function pickCrisis(_seed: string): Crisis { return CRISES[0]; }

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Stock only flows to the brand's primary + (random subset of) secondary states.
// Every other state = 0 OSA. Student must read brief to know.
function generateCityStockMap(profile: BrandProfile): CityStockMap {
  const map: CityStockMap = {} as CityStockMap;
  for (const s of BLINKIT_STATES) map[s] = 0;
  // Primary state: solid stock
  map[profile.primaryState] = randInt(65, 88);
  // Pick 1-3 secondary states with moderate stock
  const sec = [...profile.secondaryStates].sort(() => Math.random() - 0.5).slice(0, randInt(1, profile.secondaryStates.length));
  for (const s of sec) map[s] = randInt(25, 70);
  return map;
}

function generateInventoryState(label: InventoryStateLabel): InventoryState {
  switch (label) {
    case "Healthy":
      return { id: "healthy", label, osa: randInt(80, 92), fillRate: randInt(85, 95), activeStores: 54, agingUnits: 80, tone: "healthy" };
    case "Shaky":
      return { id: "warning", label, osa: randInt(60, 79), fillRate: randInt(70, 80), activeStores: 38, agingUnits: 260, tone: "warning" };
    case "Critical":
      return { id: "critical", label, osa: randInt(40, 59), fillRate: randInt(55, 70), activeStores: 22, agingUnits: 120, tone: "critical" };
    case "Overstocked":
      return { id: "overstocked", label, osa: randInt(90, 97), fillRate: randInt(95, 99), activeStores: 60, agingUnits: randInt(1000, 1500), tone: "overstocked" };
  }
}

function generateClientGoals(profile: BrandProfile, inventoryLabel: InventoryStateLabel): ClientGoals {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const threshold = "90%+ goal achievement = promotion to Senior Executive.";

  const make = (
    primary: string,
    lifecycle: BrandLifecycle,
    performanceGoals: GoalMetric[],
    reachGoals: GoalMetric[],
    campaignHint: string,
  ): ClientGoals => ({
    primary, lifecycle, performanceGoals, reachGoals,
    metrics: [...performanceGoals, ...reachGoals],
    threshold, campaignHint,
  });

  if (inventoryLabel === "Overstocked") {
    return make(
      "Move aging stock before it expires",
      "Retain",
      [
        { label: "Sell-through", target: 85, unit: "%" },
        { label: "Reduce aging units", target: 1500, unit: "units" },
        { label: "Minimum ROAS", target: 1.5, unit: "x" },
      ],
      [], // no awareness spend when clearing stock
      "Clearance mode — put all budget into Product Booster or Recommendation Ads. No awareness spend until stock normalises.",
    );
  }

  switch (profile.goalType) {
    case "ROAS-First":
      return make(
        "Drive efficient sales and return on ad spend",
        "Convert",
        [
          { label: "ROAS", target: pick([3, 4, 5]), unit: "x" },
          { label: "Units sold", target: pick([600, 800, 1000]), unit: "units" },
          { label: "Sell-through", target: pick([50, 60, 70]), unit: "%" },
        ],
        [
          { label: "Reach", target: pick([200000, 300000, 400000]), unit: "users" },
        ],
        "Lead with Product Booster to convert high-intent buyers. Add a Listing Spotlight to stay visible on the shelf and build a retarget pool.",
      );

    case "Awareness-First":
      return make(
        "Build brand recognition among new shoppers",
        "Acquire",
        [
          { label: "CTR", target: pick([1.5, 2, 2.5]), unit: "%" },
          { label: "Units sold", target: pick([80, 100, 120]), unit: "units" },
        ],
        [
          { label: "Impressions", target: pick([3000000, 5000000, 7000000]), unit: "imp" },
          { label: "Branded search lift", target: pick([20, 30, 40]), unit: "%" },
        ],
        "Lead with Listing Spotlight or Brand Booster to introduce the brand. Add a small Product Booster to capture the few people already searching.",
      );

    case "Category-Creation":
      return make(
        "Pioneer this category and educate new shoppers",
        "Acquire",
        [
          { label: "Units sold", target: pick([60, 80, 100]), unit: "units" },
        ],
        [
          { label: "Reach", target: pick([800000, 1000000, 1200000]), unit: "users" },
          { label: "Impressions", target: pick([6000000, 7000000, 8000000]), unit: "imp" },
          { label: "Category awareness lift", target: pick([15, 20, 25]), unit: "%" },
        ],
        "Category barely exists on Blinkit. Lead with Listing Spotlight to educate customers. Product Booster won't work until people know to search for you.",
      );

    case "Volume-First":
      return make(
        "Maximum units sold — scale both reach and conversions",
        "Convert",
        [
          { label: "Units", target: pick([1200, 1500, 1800]), unit: "units" },
          { label: "CVR", target: pick([6, 8, 10]), unit: "%" },
          { label: "Repeat purchase", target: pick([20, 25, 30]), unit: "%" },
        ],
        [
          { label: "Reach", target: pick([400000, 500000, 600000]), unit: "users" },
        ],
        "Volume brands need both scale and conversions. Run Recommendation Ads for units AND Brand Booster to keep the funnel full.",
      );

    default:
      return make("Drive sales", "Convert", [], [], "");
  }
}

export function generateScenario(): Scenario {
  const profile = rand(BRAND_PROFILES);
  const cityStockMap = generateCityStockMap(profile);
  const season = rand(SEASONS);
  const market = rand(MARKET_CONDITIONS);
  const inventoryLabel = rand(INVENTORY_STATE_LABELS);
  const inventory = generateInventoryState(inventoryLabel);
  const clientGoals = generateClientGoals(profile, inventoryLabel);
  const states = Object.keys(cityStockMap) as CityName[];
  const topState = states.reduce((a, b) => (cityStockMap[a] > cityStockMap[b] ? a : b));
  return {
    seed: `${profile.id}-${Date.now()}`,
    profile, cityStockMap, season, market, inventory,
    budget: 200000, clientGoals, city: topState,
    scheduledCrisis: SCHEDULED_CRISIS_BY_PROFILE[profile.id] ?? { day: 12, eventId: "stock_crisis", reason: "Mid-flight supply disruption" },
  };
}

export function pickScenario(_seed: string): Scenario { return generateScenario(); }

// Active dark stores in a state, factored by OSA
export function activeStoresFor(state: CityName, osaPct: number) {
  return Math.round((osaPct / 100) * (CITY_STORE_COUNT[state] || 0));
}

// States where the brand actually has stock (>0 OSA)
export function stockedStates(scenario: Scenario): CityName[] {
  return (Object.keys(scenario.cityStockMap) as CityName[]).filter((s) => scenario.cityStockMap[s] > 0);
}

/**
 * Returns the offline (MT/GT) sell-through presence for a specific SKU in a specific state.
 * Checks SKU-level override first, falls back to brand base, defaults to "none".
 */
export function getSkuStatePresence(
  profile: BrandProfile,
  skuId: string,
  state: StateName,
): OfflinePresence {
  const sp = profile.statePresence;
  if (!sp) return "none";
  const override = sp.skuOverrides?.[skuId]?.[state];
  if (override !== undefined) return override;
  return sp.base[state] ?? "none";
}
