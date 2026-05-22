// Static data + scenario generator for the Blinkit simulator.

export type Velocity = "Very Low" | "Low" | "Medium" | "High";
export type Difficulty = "Medium" | "Hard" | "Very Hard";
export type GoalType = "ROAS-First" | "Awareness-First" | "Category-Creation" | "Volume-First" | "Inventory-Clearance";

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
}

export const BRAND_PROFILES: BrandProfile[] = [
  {
    id: "henlo", name: "Henlo", emoji: "🐾", category: "Dog Treats", difficulty: "Medium",
    context: "Henlo is a 2-year-old D2C pet brand launching on Blinkit. Dog treats are their bestseller offline.",
    cityContext: "Bangalore",
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
  },
  {
    id: "glow", name: "Glow Republic", emoji: "✨", category: "Premium Skincare", difficulty: "Hard",
    context: "New D2C skincare brand. Zero presence on Blinkit. Customers don't search for Glow Republic yet — brand awareness is very low.",
    cityContext: "Delhi NCR",
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
  },
  {
    id: "vitaboost", name: "VitaBoost", emoji: "💊", category: "Health Supplements", difficulty: "Very Hard",
    context: "VitaBoost wants to pioneer the supplements category on Blinkit. No competitor has cracked it. Customers aren't trained to buy supplements in 10 minutes yet.",
    cityContext: "Mumbai",
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
  },
  {
    id: "tinybuddy", name: "TinyBuddy", emoji: "👶", category: "Baby Care", difficulty: "Hard",
    context: "TinyBuddy is a trusted offline baby brand entering Blinkit. Their customer is the new parent — highly specific, shops in the morning, very brand-loyal once converted.",
    cityContext: "Delhi NCR",
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
  },
  {
    id: "munchbox", name: "MunchBox", emoji: "🍿", category: "Packaged Snacks", difficulty: "Medium",
    context: "MunchBox makes healthy snacks. Launching on Blinkit. The category is brutally competitive — Haldirams, Lay's, Bingo all bidding aggressively on generic keywords.",
    cityContext: "Mumbai",
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
  },
  {
    id: "pawlife", name: "PawLife", emoji: "🦮", category: "Pet Accessories", difficulty: "Hard",
    context: "PawLife makes premium pet accessories. Launching on Blinkit. These are considered purchases — a dog owner thinks before buying a harness, unlike dog treats.",
    cityContext: "Hyderabad",
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
  },
  {
    id: "fuelup", name: "FuelUp", emoji: "💪", category: "Protein & Fitness", difficulty: "Very Hard",
    context: "FuelUp is a premium protein brand. Launching on Blinkit. Customers are gym-goers concentrated in specific localities like Koramangala, Bandra, Jubilee Hills — not spread across the entire city.",
    cityContext: "Bangalore",
    skus: [
      { id: "fuel-1", name: "FuelUp Whey Protein Chocolate 500g", mrp: 1299, margin: 260, velocity: "Low" },
      { id: "fuel-2", name: "FuelUp Plant Protein Vanilla 400g", mrp: 999, margin: 200, velocity: "Very Low" },
      { id: "fuel-3", name: "FuelUp Protein Bar Choco Fudge 60g", mrp: 99, margin: 15, velocity: "Medium" },
    ],
    goodKeywords: ["whey protein", "protein supplement", "protein bar", "plant protein", "fitness supplement"],
    riskyKeywords: ["fuelup", "gym protein"],
    optimalObjective: "performance", optimalAdFormat: "product_booster",
    trap: "Pan India targeting burns budget. Demand is hyperlocal — only gym-dense pin codes like Koramangala, Bandra, Jubilee Hills",
    unitEconomics: "Avg MRP ₹799 · Avg Margin ₹158 · Hyperlocal demand",
    relevantCategories: ["Health & Wellness", "Sports Nutrition"],
    goalType: "ROAS-First",
  },
];

export const CITIES = ["Bangalore", "Delhi NCR", "Mumbai", "Hyderabad"] as const;
export type CityName = typeof CITIES[number];

export const CITY_STORE_COUNT: Record<CityName, number> = {
  Bangalore: 40,
  "Delhi NCR": 55,
  Mumbai: 48,
  Hyderabad: 28,
};

// City macro -> child cities used in the existing city tree dropdown
export const CITY_TO_CHILDREN: Record<CityName, string[]> = {
  Bangalore: ["Bengaluru"],
  "Delhi NCR": ["New Delhi", "Noida", "Gurugram", "Faridabad"],
  Mumbai: ["Mumbai", "Thane", "Navi Mumbai"],
  Hyderabad: ["Hyderabad"],
};

export const SEASONS = [
  { name: "Normal Week", note: "Baseline demand, no spikes." },
  { name: "Festival Surge", note: "Diwali/Holi — demand +40%, CPMs +30%." },
  { name: "Post-Festival Slowdown", note: "Demand -40%, careful with spend." },
  { name: "Summer Season", note: "Skincare/beverage spike." },
  { name: "New Year Health Spike", note: "Supplements/protein boom." },
] as const;

export const MARKET_CONDITIONS = [
  { name: "Stable Market", note: "No major competitor moves." },
  { name: "Aggressive Competitor", note: "CPMs +35%." },
  { name: "Price War in Category", note: "Margins squeezed across the shelf." },
  { name: "New Entrant Disrupting", note: "A new brand is buying share aggressively." },
  { name: "Platform Pushing Private Label", note: "Blinkit pushing its own label in your category." },
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

export interface ClientGoals {
  primary: string;
  metrics: { label: string; target: number; unit: string }[];
  threshold: string;
}

export interface ScheduledCrisis {
  day: number;
  eventId: string;
  reason: string;
}
// Per-profile scheduled crisis (deterministic)
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
  cityStockMap: CityStockMap;
  season: typeof SEASONS[number];
  market: typeof MARKET_CONDITIONS[number];
  inventory: InventoryState;
  budget: number;
  clientGoals: ClientGoals;
  scheduledCrisis: ScheduledCrisis;
  // legacy city field for back-compat (highest OSA city)
  city: CityName;
}

// --- Crisis (kept from legacy Results screen) ---
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

// --- Helpers ---
function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateCityStockMap(): CityStockMap {
  const map = {} as CityStockMap;
  for (const c of CITIES) map[c] = randInt(0, 95);
  // Ensure at least one city has OSA >= 60
  const cities = Object.keys(map) as CityName[];
  const max = cities.reduce((a, b) => (map[a] > map[b] ? a : b));
  if (map[max] < 60) map[max] = randInt(60, 95);
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
  if (inventoryLabel === "Overstocked") {
    return {
      primary: "Move aging stock before it expires",
      metrics: [
        { label: "Sell-through", target: 85, unit: "%" },
        { label: "Reduce aging units", target: 1500, unit: "units" },
        { label: "Minimum ROAS", target: 1.5, unit: "x" },
      ],
      threshold: "90%+ goal achievement = promotion to Senior Executive.",
    };
  }
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  switch (profile.goalType) {
    case "ROAS-First":
      return {
        primary: "Drive sales and ROAS",
        metrics: [
          { label: "ROAS", target: pick([3, 4, 5]), unit: "x" },
          { label: "Units sold", target: pick([600, 800, 1000]), unit: "units" },
          { label: "Sell-through", target: pick([50, 60, 70]), unit: "%" },
        ],
        threshold: "90%+ goal achievement = promotion to Senior Executive.",
      };
    case "Awareness-First":
      return {
        primary: "Build brand recognition",
        metrics: [
          { label: "Impressions", target: pick([3000000, 5000000, 7000000]), unit: "imp" },
          { label: "CTR", target: pick([2, 2.5, 3]), unit: "%" },
          { label: "Branded search lift", target: pick([20, 30, 40]), unit: "%" },
        ],
        threshold: "90%+ goal achievement = promotion to Senior Executive.",
      };
    case "Category-Creation":
      return {
        primary: "Pioneer this category on Blinkit",
        metrics: [
          { label: "Reach", target: pick([800000, 1000000, 1200000]), unit: "users" },
          { label: "Impressions", target: pick([6000000, 7000000, 8000000]), unit: "imp" },
          { label: "Category awareness lift", target: pick([15, 20, 25]), unit: "%" },
        ],
        threshold: "90%+ goal achievement = promotion to Senior Executive.",
      };
    case "Volume-First":
      return {
        primary: "Maximum units sold",
        metrics: [
          { label: "Units", target: pick([1200, 1500, 1800]), unit: "units" },
          { label: "CVR", target: pick([6, 8, 10]), unit: "%" },
          { label: "Repeat purchase", target: pick([20, 25, 30]), unit: "%" },
        ],
        threshold: "90%+ goal achievement = promotion to Senior Executive.",
      };
    default:
      return { primary: "Drive sales", metrics: [], threshold: "" };
  }
}

export function generateScenario(): Scenario {
  const profile = rand(BRAND_PROFILES);
  const cityStockMap = generateCityStockMap();
  const season = rand(SEASONS);
  const market = rand(MARKET_CONDITIONS);
  const inventoryLabel = rand(INVENTORY_STATE_LABELS);
  const inventory = generateInventoryState(inventoryLabel);
  const clientGoals = generateClientGoals(profile, inventoryLabel);
  const cities = Object.keys(cityStockMap) as CityName[];
  const topCity = cities.reduce((a, b) => (cityStockMap[a] > cityStockMap[b] ? a : b));
  return {
    seed: `${profile.id}-${Date.now()}`,
    profile, cityStockMap, season, market, inventory,
    budget: 200000, clientGoals, city: topCity,
  };
}

// Back-compat: old code calls pickScenario(seed) — now ignore seed and generate fresh
export function pickScenario(_seed: string): Scenario {
  return generateScenario();
}

export function activeStoresFor(city: CityName, osaPct: number) {
  return Math.round((osaPct / 100) * CITY_STORE_COUNT[city]);
}
