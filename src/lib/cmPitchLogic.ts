/**
 * CM pitch logic: pushbacks, reply scoring, final result.
 *
 * Pure functions, no React. Called by CmPitch.tsx after the student submits
 * their pitch. The result shape (CmPitchResult) is stored by SimContext and
 * must not change; pitchScoreToRelationship is used by SimContext too.
 *
 * Copy rules (Gaurav, 2026-10-11): plain words a 15-year-old understands,
 * short sentences, every term explained the first time, no em dashes.
 *
 * Variety:
 *   - Each pushback has a few message variants; one is picked at random.
 *   - With more issues than the 3-pushback cap, the set is shuffled.
 *   - Reply order is shuffled so the best answer isn't always first.
 */

import { Scenario, StateName, CityName, getSkuStatePresence, OfflinePresence } from "@/data/scenarios";
import { CmPitchResult } from "@/context/SimContext";

// ─── Input types ─────────────────────────────────────────────────────────────

export interface PitchedSKU {
  skuId: string;
  skuName: string;
  velocity: string; // "High" | "Medium" | "Low" | "Very Low"
  mrp: number;
  margin: number;
  reasoning: string;
  justification: string;
  cities: string[];
  /** Units committed for 0-OSA states: state → units the student says they'll stock */
  stockCommitments?: Record<string, number>;
}

// ─── Data card: the numbers behind one of Rohit's lines ──────────────────────

export interface DataCardRow {
  label: string;
  value: string;
  status: "good" | "warn" | "bad" | "neutral";
}

export interface DataCard {
  title: string;
  rows: DataCardRow[];
}

// ─── Replies: the student picks one per pushback ─────────────────────────────

export type ResponseQuality = "strong" | "ok" | "weak";

export interface ResponseOption {
  key: string;
  text: string;
  /** Shown before the student picks: what this reply costs or commits them to. */
  cost: string;
  quality: ResponseQuality;
  scoreImpact: number; // strong +3, ok +1, weak -1
  cmAck: string;
}

export interface Pushback {
  id: string;
  cmMessage: string;
  dataCard: DataCard;
  responses: ResponseOption[]; // always 3, order shuffled at build time
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function osaStatus(pct: number): DataCardRow["status"] {
  return pct >= 70 ? "good" : pct > 0 ? "warn" : "bad";
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher-Yates shuffle; returns a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const shortName = (name: string) => name.split(" ").slice(-3).join(" ");

const STRONG = { quality: "strong" as const, scoreImpact: 3 };
const OK = { quality: "ok" as const, scoreImpact: 1 };
const WEAK = { quality: "weak" as const, scoreImpact: -1 };

// ─── Pushback builders ────────────────────────────────────────────────────────
// Each builder returns null if its condition isn't met for this pitch.

function buildZeroStockPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const { cityStockMap } = scenario;
  const zeroHits = pitched.flatMap((s) =>
    s.cities.filter((c) => (cityStockMap[c] ?? 0) === 0).map((c) => ({ skuName: s.skuName, city: c, sku: s }))
  );
  if (zeroHits.length === 0) return null;

  const allCities  = Array.from(new Set(pitched.flatMap((s) => s.cities)));
  const badCities  = Array.from(new Set(zeroHits.map((x) => x.city)));
  const goodCities = allCities.filter((c) => (cityStockMap[c] ?? 0) > 0);
  const badList    = badCities.join(", ");
  const goodList   = goodCities.join(", ") || "none";

  // Committed units across all SKUs for zero-stock states
  const commitments: Record<string, number> = {};
  for (const s of pitched) {
    for (const city of badCities) {
      commitments[city] = (commitments[city] ?? 0) + (s.stockCommitments?.[city] ?? 0);
    }
  }
  const committedCities      = badCities.filter((c) => (commitments[c] ?? 0) > 0);
  const uncommittedBadCities = badCities.filter((c) => (commitments[c] ?? 0) === 0);
  const hasCommitments       = committedCities.length > 0;

  const uncommittedNote = uncommittedBadCities.length > 0
    ? ` Also, ${uncommittedBadCities.join(", ")} ${uncommittedBadCities.length > 1 ? "have" : "has"} no stock and you promised none. Why ${uncommittedBadCities.length > 1 ? "are they" : "is it"} still in the pitch?`
    : "";

  const dataRows: DataCardRow[] = allCities.map((c) => {
    const osa    = cityStockMap[c] ?? 0;
    const commit = commitments[c] ?? 0;
    if (osa === 0 && commit > 0) {
      return { label: c, value: `No stock yet, ${commit.toLocaleString("en-IN")} units promised`, status: "warn" };
    }
    return { label: c, value: osa > 0 ? `${osa}% of stores` : "No stock", status: osaStatus(osa) };
  });

  let messages: string[];
  let responses: ResponseOption[];

  if (hasCommitments) {
    const commitSummary = committedCities.map((c) => `${c}: ${(commitments[c] ?? 0).toLocaleString("en-IN")} units`).join(", ");
    messages = [
      `You promised stock for places that have none today (${commitSummary}). Thanks for being upfront. But promises like this often fall through. When exactly will the units arrive, and who has signed off?${uncommittedNote}`,
      `I see the stock you promised (${commitSummary}). Your ads start on day 1, but the stock may only arrive around day 7. Until then, shoppers would click your ad and find nothing. How will you handle that gap?${uncommittedNote}`,
    ];
    responses = shuffle([
      {
        key: "firm_timeline", ...STRONG,
        text: "The stock has already left our warehouse. It reaches Blinkit in 4 to 5 days. I won't start ads there until it is on the shelves.",
        cost: "You promise: no ads in the new states until the stock arrives.",
        cmAck: "That's the right order: stock first, then ads. Approved, as long as we check the stock has landed first.",
      },
      {
        key: "phased_launch", ...OK,
        text: `I'll start ads only in ${goodList.split(",")[0]?.trim() || "the states with stock"} on day 1. I'll add ${committedCities.join(", ")} once the stock is confirmed.`,
        cost: "You promise: a slower start in the new states.",
        cmAck: "A step-by-step start makes sense. Don't switch on the new states until the stock is confirmed.",
      },
      {
        key: "optimistic", ...WEAK,
        text: "Our supply team is confident it will arrive in the first week. Meanwhile we'll bid hard in the states that have stock.",
        cost: "No firm date. Rohit has to trust you.",
        cmAck: "Being confident isn't a delivery date. If the stock isn't there by day 7, I'll pause ads in those states.",
      },
    ]);
  } else {
    messages = [
      `I'm looking at your stock. ${badList}: no stores there have your product. Blinkit doesn't show ads where a product is out of stock, so that money does nothing. Why did you include ${badCities.length > 1 ? "those states" : "that state"}?`,
      `Before we go on: ${badList} ${badCities.length > 1 ? "have" : "has"} zero stock. No stock means no ads and no sales. Explain your thinking.`,
    ];
    responses = shuffle([
      {
        key: "remove", ...STRONG,
        text: `You're right, I missed that. I'll keep only ${goodList}, where we actually have stock.`,
        cost: "You drop the states with no stock from the pitch.",
        cmAck: "Good call. You owned the data. Approved for the states where you have stock.",
      },
      {
        key: "restock", ...OK,
        text: `New stock reaches ${badList} in 7 to 10 days. I pitched early to get shelf space before it arrives.`,
        cost: "You promise: stock in those states within 10 days.",
        cmAck: "I'll hold you to that. If the stock doesn't arrive, I'll pause your ads there.",
      },
      {
        key: "demand", ...WEAK,
        text: "People want our product in those states. The missing stock is just a delay, not a lack of demand.",
        cost: "No promise and no data. Just a claim.",
        cmAck: "Demand without stock just means let-down shoppers. Your ads won't run there at all. I'm noting this as a risk.",
      },
    ]);
  }

  return {
    id: "zero_stock",
    cmMessage: pick(messages),
    dataCard: { title: "Stores with stock (OSA) in the states you picked", rows: dataRows },
    responses,
  };
}

function buildVelocityPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const mismatches = pitched.filter(
    (s) => (s.velocity === "Low" || s.velocity === "Very Low") && s.reasoning === "Proven high velocity offline"
  );
  if (mismatches.length === 0) return null;

  const { profile } = scenario;
  const names = mismatches.map((s) => s.skuName).join(", ");
  const vel   = mismatches[0].velocity.toLowerCase();

  const messages = [
    `You said ${names} "sells fast in shops". My Blinkit data says it sells ${vel}. Shop sales don't always carry over to the app. Give me a better reason.`,
    `Your reason for ${names} is "sells fast in shops", but on Blinkit its sales speed is ${vel}. Those don't match. What is really behind this claim?`,
  ];

  const velRows: DataCardRow[] = profile.skus.map((s) => ({
    label: s.name,
    value: `Sells ${s.velocity.toLowerCase()} · price ${inr(s.mrp)} · you keep ${inr(s.margin)}`,
    status: s.velocity === "High" ? "good" : s.velocity === "Medium" ? "warn" : "bad",
  }));

  const responses: ResponseOption[] = shuffle([
    {
      key: "correct_reasoning", ...STRONG,
      text: `Fair point, I used the wrong reason. ${names} is our premium product. Its job is to make the brand look good and help other products sell, not to sell fast.`,
      cost: "You change your reason to match the data.",
      cmAck: "Thanks for correcting it with data. We'll treat it as a premium product with different targets.",
    },
    {
      key: "future_projection", ...OK,
      text: `It sells ${vel} because we haven't advertised yet. With ads, we expect it to sell about 3 times faster.`,
      cost: "You promise: faster sales in week 1 once ads run.",
      cmAck: "That's a guess. I'll allow it, but I want to see week 1 results before we go bigger.",
    },
    {
      key: "offline_data", ...WEAK,
      text: "Our sales in big shops tell a different story. Blinkit's numbers don't show the full picture.",
      cost: "No Blinkit data. Just a claim.",
      cmAck: "This is a Blinkit pitch, so Blinkit sales are what count. Don't expect top shelf spots for this one.",
    },
  ]);

  return {
    id: "velocity_mismatch",
    cmMessage: pick(messages),
    dataCard: { title: "How fast each product sells on Blinkit", rows: velRows },
    responses,
  };
}

function buildDilutionPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const { cityStockMap, budget } = scenario;
  const allCities = Array.from(new Set(pitched.flatMap((s) => s.cities)));
  if (allCities.length < 10) return null;

  const stockedCount   = allCities.filter((c) => (cityStockMap[c] ?? 0) > 0).length;
  const budgetPerState = Math.round(budget / allCities.length);
  const top3 = allCities
    .filter((c) => (cityStockMap[c] ?? 0) > 0)
    .sort((a, b) => (cityStockMap[b] ?? 0) - (cityStockMap[a] ?? 0))
    .slice(0, 3);

  const messages = [
    `You picked ${allCities.length} states with a budget of ${inr(budget)}. That's only ${inr(budgetPerState)} per state. Shoppers need to see an ad several times before they buy, and that money is too thin for that anywhere. What's the plan?`,
    `${allCities.length} states on ${inr(budget)} means ${inr(budgetPerState)} each. On Blinkit it's better to be strong in a few places than weak everywhere. Where are you really trying to win?`,
  ];

  const rows: DataCardRow[] = [
    { label: "States in your pitch", value: `${allCities.length}`, status: "bad" },
    { label: "States with stock", value: `${stockedCount} of ${allCities.length}`, status: stockedCount < allCities.length * 0.6 ? "bad" : "warn" },
    { label: "Budget per state", value: inr(budgetPerState), status: budgetPerState < 10000 ? "bad" : "warn" },
    { label: "Total budget", value: inr(budget), status: "neutral" },
    ...(top3.length > 0 ? [{ label: "States with the most stock", value: top3.join(", "), status: "good" as const }] : []),
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "concentrate", ...STRONG,
      text: `You're right. With ${inr(budget)}, I'll focus on ${top3.length > 0 ? top3.join(", ") : "the states with the most stock"}. More ads in fewer places gets more sales per rupee.`,
      cost: "You drop most states from the pitch.",
      cmAck: "Now that's a plan. Focus wins on Blinkit. Approved for the smaller set.",
    },
    {
      key: "phased", ...OK,
      text: "I'll put most of the money into my top 3 states in week 1, then add more states once I see what works.",
      cost: "You promise: week 1 spend stays in 3 states.",
      cmAck: "Fine, if you really do it that way. Week 1 stays focused. Don't spread out on day 1.",
    },
    {
      key: "national_brand", ...WEAK,
      text: "We want people all over India to know us. Ads are cheaper in small states, so going wide is efficient.",
      cost: "No change. Your budget stays spread thin.",
      cmAck: "Seeing an ad once doesn't make people remember you. They need to see it several times in one place. This is a very common mistake.",
    },
  ]);

  return {
    id: "dilution",
    cmMessage: pick(messages),
    dataCard: { title: "How far your budget stretches", rows },
    responses,
  };
}

function buildCompetitorPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  if (scenario.market.name !== "Aggressive Competitor") return null;

  const { profile, budget, cityStockMap } = scenario;
  const strongholds = Object.entries(cityStockMap)
    .filter(([, v]) => v >= 70)
    .map(([k]) => k)
    .slice(0, 3);

  const messages = [
    `Before I sign off: a rival with a big budget is bidding hard in ${profile.category} right now. Ads cost about 35% more than usual. Your ${inr(budget)} buys fewer ad views than you planned. How does your plan hold up?`,
    `Ad prices in your category are up about 35% because a rival is spending heavily. Where exactly will you win with ${inr(budget)}?`,
  ];

  const rows: DataCardRow[] = [
    { label: "Market right now", value: "A rival is spending heavily", status: "bad" },
    { label: "Price per 1,000 ad views (CPM)", value: "About 35% higher than usual", status: "bad" },
    { label: "Top ad spots", value: "Harder to win", status: "warn" },
    { label: "Your category", value: profile.category, status: "neutral" },
    { label: "Your states with good stock", value: strongholds.join(", ") || "None", status: strongholds.length > 0 ? "good" : "bad" },
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "defend_stronghold", ...STRONG,
      text: `I'll focus on ${strongholds.length > 0 ? strongholds.join(", ") : "the states with the most stock"}, where we're strongest. I'll bid about 30% more on our best product there and skip places where the rival is stronger.`,
      cost: "You give up states where the rival is strong.",
      cmAck: "Smart. Pick your battles and defend where you're strong. That's right when ads cost more.",
    },
    {
      key: "differentiate", ...OK,
      text: "Our product is different enough to sell even when ads cost more. We'll keep our bids and watch closely.",
      cost: "No change. You watch results every day.",
      cmAck: "Okay, but check daily. If you make less than ₹1.50 in sales per ₹1 of ads in week 1, pull back.",
    },
    {
      key: "proceed", ...WEAK,
      text: "We'll go ahead as planned. The rival might not be in all our states.",
      cost: "No plan. You hope for gaps.",
      cmAck: "Hoping for gaps isn't a plan. Your budget will get squeezed. I'm noting this as a risk.",
    },
  ]);

  return {
    id: "competition",
    cmMessage: pick(messages),
    dataCard: { title: "What your rivals are doing", rows },
    responses,
  };
}

function buildInventoryPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  if (scenario.inventory.tone !== "critical" && scenario.inventory.tone !== "warning") return null;

  const { inventory } = scenario;

  const messages = [
    `First, your stock. Only ${inventory.osa}% of stores have your product (OSA), and your warehouse delivers just ${inventory.fillRate}% of what stores order (fill rate). If ads bring shoppers who find nothing, they leave unhappy. How will you stop that?`,
    `I always check stock before approving ads. ${inventory.osa}% of stores have your product and your warehouse fills ${inventory.fillRate}% of orders. Running big ads on that is risky. What's your plan?`,
  ];

  const rows: DataCardRow[] = [
    { label: "Stores with stock (OSA)", value: `${inventory.osa}%`, status: inventory.osa < 50 ? "bad" : "warn" },
    { label: "Orders your warehouse fills (fill rate)", value: `${inventory.fillRate}%`, status: inventory.fillRate < 70 ? "bad" : "warn" },
    { label: "Stores selling it", value: `${inventory.activeStores}`, status: inventory.activeStores < 30 ? "bad" : "warn" },
    { label: "Old units sitting in stores", value: `${inventory.agingUnits}`, status: inventory.agingUnits > 200 ? "bad" : "warn" },
    { label: "Stock health", value: inventory.label, status: inventory.tone === "critical" ? "bad" : "warn" },
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "limit_scope", ...STRONG,
      text: "Fair point. I'll only run ads where more than 70% of stores have stock, use a daily budget so spend stays in control, and start with our best-margin product. We'll fix supply at the same time.",
      cost: "You give up states with weak stock for now.",
      cmAck: "That's responsible. A small, well-stocked start is right when stock is shaky.",
    },
    {
      key: "small_test", ...OK,
      text: "I'll run a small ₹20,000 test in the 2 states with the most stock while our supply team fixes the rest.",
      cost: "You promise: a ₹20,000 test before going bigger.",
      cmAck: "A small test is sensible. Don't go bigger until more than 70% of stores have stock.",
    },
    {
      key: "push_anyway", ...WEAK,
      text: "Running ads will push our team to fix supply faster.",
      cost: "No plan for empty shelves.",
      cmAck: "Ads don't fix supply. They just let shoppers down faster. I'm noting this as a risk.",
    },
  ]);

  return {
    id: "inventory",
    cmMessage: pick(messages),
    dataCard: { title: "Your stock health", rows },
    responses,
  };
}

// ─── Fill rate pushback ───────────────────────────────────────────────────────
/**
 * Fires when the student pitches several states but the fill rate is too low
 * to keep all of them stocked. Threshold: fillRate < 70 and more than 1 state.
 */
function buildFillRatePushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const { inventory, cityStockMap } = scenario;
  const allCities = Array.from(new Set(pitched.flatMap((s) => s.cities)));

  if (inventory.fillRate >= 70 || allCities.length <= 1) return null;

  const fillRate = inventory.fillRate;
  // Rough runway: starting stock % plus a month of refills, minus ~40% sold with ads running.
  const stateRunways = allCities.map((c) => {
    const osa = cityStockMap[c] ?? 0;
    const weeklyReplenish = fillRate / 4;
    const projectedEndPct = osa + (weeklyReplenish * 4) - 40;
    const daysRunway = osa > 0 ? Math.round((Math.max(osa, projectedEndPct) / 100) * 30) : 0;
    return { city: c, osa, daysRunway, sustainable: osa > 0 && daysRunway >= 15 };
  });

  const sustainableCount = stateRunways.filter((r) => r.sustainable).length;
  const atRiskCount      = allCities.length - sustainableCount;

  const stockedStates = allCities
    .filter((c) => (cityStockMap[c] ?? 0) >= 50)
    .sort((a, b) => (cityStockMap[b] ?? 0) - (cityStockMap[a] ?? 0));
  const commitTarget = stockedStates.slice(0, Math.max(1, sustainableCount));

  const stateRows: DataCardRow[] = stateRunways.map(({ city: c, osa, daysRunway, sustainable }) => ({
    label: c,
    value: osa > 0 ? `${osa}% of stores, about ${daysRunway} days of stock` : "No stock",
    status: sustainable ? "good" : osa > 0 ? "warn" : "bad",
  }));

  const summaryRows: DataCardRow[] = [
    { label: "Orders your warehouse fills (fill rate)", value: `${fillRate}%`, status: fillRate < 50 ? "bad" : "warn" },
    { label: "States in your pitch", value: `${allCities.length}`, status: "neutral" },
    { label: "States you can keep stocked", value: `About ${sustainableCount}`, status: sustainableCount < allCities.length ? "warn" : "good" },
    { label: "States likely to run out", value: `${atRiskCount}`, status: atRiskCount > 0 ? "bad" : "good" },
    ...(commitTarget.length > 0 ? [{ label: "Best states to focus on", value: commitTarget.join(", "), status: "good" as const }] : []),
  ];

  const messages = [
    `Your warehouse delivers only ${fillRate}% of what stores order (fill rate). At that rate you can keep about ${sustainableCount} of your ${allCities.length} states stocked. The other ${atRiskCount} will run out mid-month, while your ads keep spending. How will you handle this?`,
    `Fill rate is ${fillRate}%. You picked ${allCities.length} states, but your supply can keep about ${sustainableCount} stocked for 30 days. I'd rather approve fewer states done well. Which ones can you really keep stocked?`,
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "commit_fewer", ...STRONG,
      text: `You're right, I picked too many. I'll stick to ${commitTarget.length > 0 ? commitTarget.join(", ") : `${sustainableCount} states`}, which have the most stock. I'll add more once supply gets better.`,
      cost: "You drop the states you can't keep stocked.",
      cmAck: `Good. Fewer states with steady stock is always the right call. Approved for ${commitTarget.length > 0 ? commitTarget.join(", ") : "the smaller set"}.`,
    },
    {
      key: "improve_fillrate", ...OK,
      text: "A big delivery arrives in 2 weeks, so we'll fill more than 75% of orders by then. Can we keep the pitch? I'll tell you right away if any state drops below 60% of stores with stock.",
      cost: "You promise: better supply within 2 weeks.",
      cmAck: "Okay, on a short leash. If any state drops below 60% in week 1, I'll pause ads there.",
    },
    {
      key: "demand_pull", ...WEAK,
      text: "More ad sales will make our supply team restock faster. It feeds itself.",
      cost: "No plan. Just a claim.",
      cmAck: "You can't sell stock you don't have. More demand doesn't make trucks faster. I'm noting this as a risk.",
    },
  ]);

  return {
    id: "fill_rate",
    cmMessage: pick(messages),
    dataCard: { title: "Can you keep every state stocked?", rows: [...summaryRows, ...stateRows] },
    responses,
  };
}

function buildNoReasoningPushback(pitched: PitchedSKU[], _scenario: Scenario): Pushback | null {
  const emptySkus = pitched.filter((s) => !s.reasoning || s.reasoning.trim() === "");
  if (emptySkus.length === 0) return null;

  const names = emptySkus.map((s) => s.skuName).join(", ");

  const messages = [
    `You listed ${names} but gave no reason. Why should I give it shelf space? That's the first question in this meeting.`,
    `${names}: I need to know why. Does it sell fast? Earn good money? Help other products sell? "We want shelf space" isn't a pitch.`,
  ];

  const rows: DataCardRow[] = emptySkus.map((s) => ({ label: s.skuName, value: "No reason given", status: "bad" as const }));

  const responses: ResponseOption[] = shuffle([
    {
      key: "strong_case", ...STRONG,
      text: "Fair point. This product earns us the most per unit and people buy it again and again. It also gets shoppers to add our other products to the cart.",
      cost: "You give a clear reason Rohit can check.",
      cmAck: "That's a real reason. Lead with it next time, don't make me ask.",
    },
    {
      key: "generic_case", ...OK,
      text: "We want more people to try our brand on Blinkit. These are our main products and we think they'll sell well.",
      cost: "A vague reason with no numbers.",
      cmAck: "Vague, but it's a start. I need numbers before I give you top shelf spots.",
    },
    {
      key: "no_case", ...WEAK,
      text: "These are our main products and we want them on Blinkit. People want them, we just need to be seen.",
      cost: "No reason. Just a wish.",
      cmAck: "That's a wish, not a pitch. I'm noting it as a weak case.",
    },
  ]);

  return {
    id: "no_reasoning",
    cmMessage: pick(messages),
    dataCard: { title: "Missing reasons", rows },
    responses,
  };
}

// ─── Offline presence pushback ───────────────────────────────────────────────
/**
 * Fires when a SKU is pitched in states where shop (modern trade) sales are
 * weak or zero, with a reason that isn't an explicit new-market play.
 * "New market expansion" and "Strategic loss leader" are exempt.
 */
const OFFLINE_EXPANSION_REASONS = [
  "New market expansion",
  "Strategic loss leader for customer acquisition",
];

function buildOfflinePresencePushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const { profile } = scenario;

  type BadHit = { skuName: string; skuId: string; state: string; presence: OfflinePresence };
  const badHits: BadHit[] = [];

  for (const ps of pitched) {
    if (OFFLINE_EXPANSION_REASONS.includes(ps.reasoning)) continue;
    for (const state of ps.cities) {
      const presence = getSkuStatePresence(profile, ps.skuId, state as StateName);
      if (presence === "weak" || presence === "none") {
        badHits.push({ skuName: ps.skuName, skuId: ps.skuId, state, presence });
      }
    }
  }

  if (badHits.length === 0) return null;

  const flaggedSkuIds = Array.from(new Set(badHits.map((h) => h.skuId)));
  const dataRows: DataCardRow[] = flaggedSkuIds.flatMap((skuId) => {
    const ps = pitched.find((p) => p.skuId === skuId)!;
    return ps.cities.map((state) => {
      const presence = getSkuStatePresence(profile, skuId, state as StateName);
      const value =
        presence === "strong"   ? "Sells well in shops" :
        presence === "moderate" ? "Sells okay in shops" :
        presence === "weak"     ? "Barely sells in shops" :
                                  "Not sold in shops";
      const status: DataCardRow["status"] = presence === "strong" ? "good" : presence === "moderate" ? "warn" : "bad";
      return { label: `${shortName(ps.skuName)}, ${state}`, value, status };
    });
  });

  const badStateNames    = Array.from(new Set(badHits.map((h) => h.state)));
  const badSkuShortNames = Array.from(new Set(badHits.map((h) => shortName(h.skuName))));
  const worstPresence    = badHits.some((h) => h.presence === "none") ? "none" : "weak";
  const goodStates = Array.from(new Set(
    pitched.flatMap((ps) => ps.cities.filter((c) => {
      const p = getSkuStatePresence(profile, ps.skuId, c as StateName);
      return p === "strong" || p === "moderate";
    }))
  )).slice(0, 3);

  const reasoning = pitched.find((p) => badHits.some((b) => b.skuId === p.skuId))?.reasoning ?? "this reason";
  const shopLine = worstPresence === "none" ? "isn't sold in shops at all" : "barely sells in shops";

  const messages = [
    `I checked shop sales in big stores (modern trade). ${badSkuShortNames.join(" and ")} ${shopLine} in ${badStateNames.join(", ")}. Blinkit helps people buy what they already want, faster. It doesn't create demand from nothing. What proof do you have that people there want it?`,
    `You chose "${reasoning}", but ${badSkuShortNames.join(" and ")} ${shopLine} in ${badStateNames.join(", ")}. If people don't buy it in shops there, why would they buy it on Blinkit?`,
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "restrict_to_proven", ...STRONG,
      text: `You're right. I'll keep these products to states where they already sell in shops${goodStates.length > 0 ? `: ${goodStates.join(", ")}` : ""}.`,
      cost: "You drop states with no shop sales.",
      cmAck: "Right call. Blinkit grows demand that already exists. Approved for your main states only.",
    },
    {
      key: "new_market_case", ...OK,
      text: `We're choosing ${badStateNames.slice(0, 2).join(" and ")} on purpose, as new markets. We'll use Blinkit to enter them before shops.`,
      cost: "You accept less stock there until week 2 shows demand.",
      cmAck: "I'll accept that as a new-market play. You get little stock there until week 2 shows people want it.",
    },
    {
      key: "online_different_claim", ...WEAK,
      text: `Blinkit shoppers in ${badStateNames[0] ?? "those states"} are different from shop shoppers, so shop sales don't tell the whole story.`,
      cost: "No data. Just a theory.",
      cmAck: "That's a handy theory with no data behind it. Shoppers overlap more than you think. I'm marking these states as risky.",
    },
  ]);

  return {
    id: "offline_presence",
    cmMessage: pick(messages),
    dataCard: { title: "Sales in shops (modern trade) by state", rows: dataRows },
    responses,
  };
}

// ─── buildPushbacks ──────────────────────────────────────────────────────────
/**
 * Up to 3 pushbacks for this pitch. Zero stock and shop-sales issues come
 * first (the biggest data errors); the rest are shuffled.
 */
export function buildPushbacks(pitched: PitchedSKU[], scenario: Scenario): Pushback[] {
  // Inventory and fill rate cover the same root problem: only fire the more severe one.
  const invPb      = buildInventoryPushback(pitched, scenario);
  const fillRatePb = buildFillRatePushback(pitched, scenario);
  const inventoryOrFillRate: Pushback | null =
    invPb && fillRatePb
      ? scenario.inventory.tone === "critical" ? invPb : fillRatePb
      : invPb ?? fillRatePb ?? null;

  const candidates: (Pushback | null)[] = [
    buildZeroStockPushback(pitched, scenario),
    buildOfflinePresencePushback(pitched, scenario),
    buildVelocityPushback(pitched, scenario),
    buildNoReasoningPushback(pitched, scenario),
    inventoryOrFillRate,
    buildDilutionPushback(pitched, scenario),
    buildCompetitorPushback(pitched, scenario),
  ];

  const eligible        = candidates.filter((p): p is Pushback => p !== null);
  const zeroStock       = eligible.filter((p) => p.id === "zero_stock");
  const offlinePresence = eligible.filter((p) => p.id === "offline_presence");
  const rest            = shuffle(eligible.filter((p) => p.id !== "zero_stock" && p.id !== "offline_presence"));
  return [...zeroStock, ...offlinePresence, ...rest].slice(0, 3);
}

/** Short names for the negotiation steps (used by the pitch screen). */
export const PUSHBACK_TOPICS: Readonly<Record<string, string>> = {
  zero_stock: "States with no stock",
  offline_presence: "Shop sales",
  velocity_mismatch: "How fast it sells",
  no_reasoning: "Missing reasons",
  inventory: "Stock health",
  fill_rate: "Keeping shelves stocked",
  dilution: "Budget spread",
  competition: "Rival spending",
};

// ─── Opening message ─────────────────────────────────────────────────────────

export function buildOpeningMessage(
  pitched: PitchedSKU[],
  scenario: Scenario,
): { message: string; dataCard: DataCard } {
  const { cityStockMap, profile } = scenario;
  const allCities     = Array.from(new Set(pitched.flatMap((s) => s.cities)));
  const stockedCities = allCities.filter((c) => (cityStockMap[c] ?? 0) > 0);
  // Zero-stock states with promised stock count as "planned", not as issues
  const zeroCities = allCities.filter((c) => (cityStockMap[c] ?? 0) === 0);
  const committedInOpening = zeroCities.filter((c) => pitched.some((s) => (s.stockCommitments?.[c] ?? 0) > 0));
  const issues = zeroCities.length - committedInOpening.length;

  const totalCommitments: Record<string, number> = {};
  for (const s of pitched) {
    for (const city of allCities) {
      const units = s.stockCommitments?.[city] ?? 0;
      if (units > 0) totalCommitments[city] = (totalCommitments[city] ?? 0) + units;
    }
  }

  const stateOsaRows: DataCardRow[] = allCities.map((c) => {
    const osa    = cityStockMap[c] ?? 0;
    const commit = totalCommitments[c] ?? 0;
    if (osa === 0 && commit > 0) {
      return { label: `${c} (new)`, value: `No stock yet, ${commit.toLocaleString("en-IN")} units promised`, status: "warn" };
    }
    const status: DataCardRow["status"] = osa >= 70 ? "good" : osa >= 30 ? "warn" : "bad";
    return { label: `Stores with stock (OSA), ${c}`, value: osa > 0 ? `${osa}%` : "None", status };
  });

  const rows: DataCardRow[] = [
    { label: "Products pitched", value: `${pitched.length}`, status: pitched.length > 0 ? "neutral" : "bad" },
    { label: "Budget", value: inr(scenario.budget), status: "neutral" },
    { label: "States with stock", value: `${stockedCities.length} of ${allCities.length}`, status: stockedCities.length === allCities.length ? "good" : stockedCities.length > 0 ? "warn" : "bad" },
    ...stateOsaRows,
  ];

  const cleanMessages = [
    `I've got your ${profile.name} pitch. Let me check the numbers before I agree to anything.`,
    `Thanks for the ${profile.name} pitch. It looks clean at first glance. Let me check a few things.`,
  ];
  const issueMessages = [
    `I've got your ${profile.name} pitch. I can already see ${issues} ${plural(issues, "state")} with no stock. Let's go through my concerns.`,
    `${profile.name}, I've read the pitch. I have ${issues} ${plural(issues, "concern")} before I can approve anything.`,
  ];
  const emptyMessage = "You haven't pitched any products. I can't approve an empty pitch. Go back and build one.";

  const message = pitched.length === 0 ? emptyMessage : issues > 0 ? pick(issueMessages) : pick(cleanMessages);
  return { message, dataCard: { title: "Your pitch", rows } };
}

// ─── calcFinalResult ─────────────────────────────────────────────────────────

export function calcFinalResult(
  pitched: PitchedSKU[],
  scenario: Scenario,
  pushbacks: Pushback[],
  responses: Record<string, string>,
): CmPitchResult {
  const { cityStockMap, profile } = scenario;

  const flags: string[] = [];
  const allCities = Array.from(new Set(pitched.flatMap((s) => s.cities)));

  const zeroStockCities = allCities.filter((c) => (cityStockMap[c] ?? 0) === 0);
  const allCommitments: Record<string, number> = {};
  for (const s of pitched) {
    for (const city of zeroStockCities) {
      allCommitments[city] = (allCommitments[city] ?? 0) + (s.stockCommitments?.[city] ?? 0);
    }
  }
  const committedZeroCities   = zeroStockCities.filter((c) => (allCommitments[c] ?? 0) > 0);
  const uncommittedZeroCities = zeroStockCities.filter((c) => (allCommitments[c] ?? 0) === 0);
  if (uncommittedZeroCities.length > 0)
    flags.push(`Picked ${uncommittedZeroCities.length} ${plural(uncommittedZeroCities.length, "state")} with no stock and no stock promised`);
  if (committedZeroCities.length > 0)
    flags.push(`Promised stock in ${committedZeroCities.length} new ${plural(committedZeroCities.length, "state")}, delivery date not confirmed`);

  pitched.forEach((s) => {
    if ((s.velocity === "Low" || s.velocity === "Very Low") && s.reasoning === "Proven high velocity offline") {
      flags.push(`Said ${s.skuName} sells fast, but it sells ${s.velocity.toLowerCase()} on Blinkit`);
    }
    if (!s.reasoning || s.reasoning.trim() === "") flags.push(`${s.skuName}: no reason given`);
    if (s.cities.length === 0) flags.push(`${s.skuName}: no states picked`);

    if (!OFFLINE_EXPANSION_REASONS.includes(s.reasoning)) {
      const noneStates = s.cities.filter((c) => getSkuStatePresence(profile, s.skuId, c as StateName) === "none");
      if (noneStates.length > 0) {
        flags.push(`${shortName(s.skuName)}: not sold in shops in ${noneStates.slice(0, 2).join(", ")}${noneStates.length > 2 ? ` and ${noneStates.length - 2} more` : ""}`);
      }
    }
  });

  if (allCities.length >= 12) flags.push("Picked too many states, so the budget is spread thin");
  if (pitched.length === 0)   flags.push("No products pitched");

  const baseScore = Math.max(0, Math.min(9, 9 - flags.length * 2));

  const defenseScore = pushbacks.reduce((sum, pb) => {
    const chosen = pb.responses.find((r) => r.key === responses[pb.id]);
    return sum + (chosen ? chosen.scoreImpact : 0);
  }, 0);

  let pitchScore = Math.max(0, Math.min(15, baseScore + defenseScore));

  // Hard caps: errors a good defence can't fix.
  const hasEmptyReasoning = pitched.some((s) => !s.reasoning || s.reasoning.trim() === "");
  if (uncommittedZeroCities.length >= 2) pitchScore = Math.min(pitchScore, 7);
  else if (uncommittedZeroCities.length === 1) pitchScore = Math.min(pitchScore, 11);
  if (hasEmptyReasoning) pitchScore = Math.min(pitchScore, 11);

  let status: CmPitchResult["status"];
  let message: string;
  let osaBoost = false;

  if (pitched.length === 0) {
    status = "rejected";
    message = "You sent an empty pitch. Come back with a reason for each product.";
  } else if (pitchScore >= 12) {
    status = "strong"; osaBoost = true;
    message = "Strong pitch. You knew your numbers and made good calls when I pushed back. You get top shelf spots and 10% more stores stocked in your approved states.";
  } else if (pitchScore >= 8) {
    status = "decent";
    message = "Decent pitch. A few gaps, but the main case holds up. Normal shelf spots approved.";
  } else if (pitchScore >= 4) {
    status = "weak";
    message = "Weak pitch. Real problems in the data, and your answers didn't convince me. Small shelf space only. I'll watch week 1 closely.";
  } else {
    status = "rejected";
    message = "This pitch doesn't hold up. Too many data mistakes. Take the basic approval or pitch again.";
  }

  // Committed new states are approved only after a credible answer.
  const committedApproved = ["firm_timeline", "phased_launch"].includes(responses["zero_stock"] ?? "") ? committedZeroCities : [];
  const approvedSKUs = status === "rejected" ? [] : pitched.map((s) => s.skuId);
  const approvedCities: CityName[] = status === "rejected"
    ? []
    : Array.from(new Set(pitched.flatMap((s) => s.cities.filter((c) =>
        (cityStockMap[c] ?? 0) > 0 || committedApproved.includes(c))))) as CityName[];

  return { status, approvedSKUs, approvedCities, pitchScore, osaBoost, message, flags };
}

// ─── Relationship bootstrap ──────────────────────────────────────────────────
/**
 * Converts a pitch score (0–15) into the starting CM relationship (0–100).
 * Called once by SimContext when setCmPitch is called.
 *   Trusted 65–100 · Neutral 40–64 · Strained 20–39 · Broken 0–19
 */
export function pitchScoreToRelationship(pitchScore: number): number {
  if (pitchScore >= 12) return 72;  // strong
  if (pitchScore >= 8)  return 52;  // decent
  if (pitchScore >= 4)  return 32;  // weak
  return 15;                        // rejected / default
}

export type CmRelationshipTier = "trusted" | "neutral" | "strained" | "broken";

export function relationshipTier(score: number): CmRelationshipTier {
  if (score >= 65) return "trusted";
  if (score >= 40) return "neutral";
  if (score >= 20) return "strained";
  return "broken";
}

// ─── Closing message ─────────────────────────────────────────────────────────

export function buildClosingMessage(result: CmPitchResult, brandName: string): string {
  if (result.status === "strong") {
    return pick([
      `Alright, ${brandName}, we're good. Top shelf spots and more stores stocked in your approved states. Don't waste it. I want to see good sales per rupee of ads in week 1.`,
      "Good pitch, well defended. Top shelf spots approved. Now build campaigns that back it up.",
    ]);
  }
  if (result.status === "decent") {
    return pick([
      "Normal approval. You had some weak spots, but the main case is there. Do well this month and you'll earn more.",
      "I'm signing off on normal shelf spots. Not perfect, but good enough. Let the results speak.",
    ]);
  }
  if (result.status === "weak") {
    return pick([
      "I'll let this through, but only just. Small shelf space. Week 1 results decide what happens next.",
      "Minimum approval. Too many gaps in this pitch. I'll check your week 1 numbers before giving you more.",
    ]);
  }
  return pick([
    "I can't approve this. Take the basic approval for your best product, or use a token to pitch again.",
    "This pitch doesn't work. Take the basic approval, or go back and start again.",
  ]);
}
