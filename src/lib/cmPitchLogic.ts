/**
 * CM Pitch Logic — pushback generation, response scoring, final result.
 *
 * Pure functions — no React, no side effects.
 * Called by CmPitch.tsx after the student submits their pitch form.
 *
 * Variety design:
 *   - Each pushback type has multiple cmMessage variants; one is picked at random.
 *   - When more issues exist than the 3-pushback cap, the set is shuffled so
 *     students don't always see the same questions in the same order.
 *   - Response options are shuffled each time (so A/B/C ordering isn't memorisable).
 */

import { Scenario, StateName, getSkuStatePresence, OfflinePresence } from "@/data/scenarios";
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
  /** Units committed for 0-OSA states: city → units the student says they'll stock */
  stockCommitments?: Record<string, number>;
}

// ─── Data card — shown inline in CM chat bubble ───────────────────────────────

export interface DataCardRow {
  label: string;
  value: string;
  status: "good" | "warn" | "bad" | "neutral";
}

export interface DataCard {
  title: string;
  rows: DataCardRow[];
}

// ─── Response options — student picks one per pushback ───────────────────────

export type ResponseQuality = "strong" | "ok" | "weak";

export interface ResponseOption {
  key: string;
  text: string;
  quality: ResponseQuality;
  scoreImpact: number; // strong +3, ok +1, weak -1
  cmAck: string;
}

// ─── Pushback ─────────────────────────────────────────────────────────────────

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

/** Fisher-Yates shuffle — returns a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Pushback builders ────────────────────────────────────────────────────────
// Each builder returns null if the condition isn't met for this pitch.

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

  // Aggregate commitments across all SKUs for zero-OSA cities
  const commitments: Record<string, number> = {};
  for (const s of pitched) {
    for (const city of badCities) {
      const units = s.stockCommitments?.[city] ?? 0;
      commitments[city] = (commitments[city] ?? 0) + units;
    }
  }
  const committedCities   = badCities.filter((c) => (commitments[c] ?? 0) > 0);
  const uncommittedBadCities = badCities.filter((c) => (commitments[c] ?? 0) === 0);
  const hasCommitments    = committedCities.length > 0;

  // Appended to committed-branch messages when some zero-stock cities have no commitment
  const uncommittedNote = uncommittedBadCities.length > 0
    ? ` I also see ${uncommittedBadCities.join(", ")} ${uncommittedBadCities.length > 1 ? "have" : "has"} 0% OSA with zero commitment — why ${uncommittedBadCities.length > 1 ? "are those" : "is that"} still in the pitch?`
    : "";

  const dataRows: DataCardRow[] = allCities.map((c) => {
    const osa     = cityStockMap[c] ?? 0;
    const commit  = commitments[c] ?? 0;
    if (osa === 0 && commit > 0) {
      return { label: c, value: `No stock → ${commit.toLocaleString("en-IN")} units committed`, status: "warn" };
    }
    return { label: c, value: osa > 0 ? `${osa}% OSA` : "No stock", status: osaStatus(osa) };
  });

  // Branch: student committed stock vs no commitment at all
  let messages: string[];
  let responses: ResponseOption[];

  if (hasCommitments) {
    const commitSummary = committedCities.map((c) => `${c}: ${(commitments[c] ?? 0).toLocaleString("en-IN")} units`).join(", ");
    messages = [
      `I see you've committed stock for ${committedCities.length > 1 ? "some zero-OSA states" : badList} — ${commitSummary}. I appreciate the transparency. But I've been burned before by commitments that didn't materialise. Give me a concrete timeline: when exactly will these units land, and who in your supply chain has signed off?${uncommittedNote}`,
      `You've flagged committed stock for ${committedCities.join(", ")} — ${commitSummary}. I'll consider it. But I need to understand: what's the lead time on this replenishment, and what happens to the campaign if the stock doesn't arrive on time?${uncommittedNote}`,
      `Committed stock noted — ${commitSummary}. Here's my concern: ads go live Day 1, stock may arrive Day 7+. In that gap, you're serving impressions that lead to an out-of-stock page. Walk me through how you're going to handle that window.${uncommittedNote}`,
      `I can see you've committed units for ${committedCities.join(", ")}. That's better than nothing. But "committed" and "on-shelf" are two different things. What's the realistic buffer before the stock is actually live in the DC and available to fulfil orders?${uncommittedNote}`,
    ];
    responses = shuffle([
      {
        key: "firm_timeline",
        text: `The stock is already in transit — our 3PL confirmed dispatch 2 days ago. Lead time to Blinkit DC is 4–5 days max. I'll hold the campaign launch until inventory is confirmed live in the system. We won't serve a single impression to an empty shelf.`,
        quality: "strong",
        scoreImpact: 3,
        cmAck: "That's the right sequence — stock confirmed first, then ads live. I'll approve on condition we verify DC receipt before campaign launch.",
      },
      {
        key: "phased_launch",
        text: `We'll phase the launch — start ads only in ${goodList.split(",")[0]?.trim() || "our stocked states"} on Day 1, and activate ${committedCities.join(", ")} once the committed stock is confirmed available. We won't waste budget in the interim.`,
        quality: "ok",
        scoreImpact: 1,
        cmAck: "Phased makes sense. Don't activate the committed states until you get the in-DC confirmation. I'll monitor.",
      },
      {
        key: "optimistic",
        text: `The supply team is confident on the timeline. We're expecting it within the first week and we'll manage any short-term gap with strong bids in our existing stocked states.`,
        quality: "weak",
        scoreImpact: -1,
        cmAck: "'Confident' without a confirmed dispatch date is not a plan. I'm flagging this — if stock doesn't land by Day 7, those states get paused automatically.",
      },
    ]);
  } else {
    messages = [
      `I'm pulling up your stock data right now. ${badList} — 0% OSA. Blinkit doesn't serve a single ad impression where a product is out of stock. You'd be burning budget on clicks that lead to a dead end. Walk me through why you included ${badCities.length > 1 ? "those states" : "that state"}.`,
      `Before I go further — ${badList} ${badCities.length > 1 ? "show" : "shows"} zero on-shelf availability. We can't run ads there. Every rupee you spend in a zero-stock state is wasted — shoppers hit "unavailable" and you've just funded a bad brand experience. Explain your thinking.`,
      `I'm flagging something immediately. ${badList}: 0% OSA. You know how this works — no stock means no ad delivery, period. Why are these states in your pitch?`,
      `Hold on. ${badList} — I'm seeing 0% OSA in my system. Ads in those states are invisible money. What's the business case for including them?`,
    ];
    responses = shuffle([
      {
        key: "remove",
        text: `You're right — I should have caught that. I'll restrict the pitch to ${goodList} where we have actual stock. Including zero-stock states was an error in my analysis.`,
        quality: "strong",
        scoreImpact: 3,
        cmAck: "Good — that's the right call. Own the data. Approved states updated to where you actually have stock.",
      },
      {
        key: "restock",
        text: `We have a replenishment arriving in ${badList} in the next 7–10 days. I was pitching ahead of the restock to secure shelf placement before it lands.`,
        quality: "ok",
        scoreImpact: 1,
        cmAck: "I'll hold you to that. If the restock doesn't land, I'm pausing your ads in those states automatically.",
      },
      {
        key: "demand",
        text: `The demand signal from offline is strong in those states. The zero Blinkit OSA is a supply lag, not a demand issue — the category has real pull there.`,
        quality: "weak",
        scoreImpact: -1,
        cmAck: "Demand without supply just means disappointed customers. Your ads will show 0 delivery in those states — the budget simply won't spend. Noted as a risk on your account.",
      },
    ]);
  }

  return {
    id: "zero_stock",
    cmMessage: pick(messages),
    dataCard: { title: "📦 OSA by Selected States", rows: dataRows },
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
  const vel   = mismatches[0].velocity;

  const messages = [
    `You claimed "Proven high velocity offline" for ${names}. I'm staring at the internal data — that SKU is ${vel} velocity on Blinkit. Either your offline numbers don't translate here, or you're trying to get premium placement for a slow mover. I need a better justification.`,
    `"Proven high velocity" — but our system says ${vel} for ${names}. That's not a match. I've seen this before: brands use offline numbers to justify quick-commerce pitches, but the channels are completely different. What's actually driving this claim?`,
    `${names}: you called it "high velocity offline" but Blinkit data shows ${vel}. I don't approve pitches based on claims that contradict the data I have in front of me. Talk me through this discrepancy.`,
    `I'm going to stop you on the velocity claim for ${names}. The system shows ${vel}. "Proven high velocity offline" is not a reason I can put in the approval — I need you to either correct it or give me something defensible.`,
  ];

  const velRows: DataCardRow[] = profile.skus.map((s) => ({
    label: s.name,
    value: `${s.velocity} velocity · ₹${s.mrp} MRP · ₹${s.margin} margin`,
    status: s.velocity === "High" ? "good" : s.velocity === "Medium" ? "warn" : "bad",
  }));

  const responses: ResponseOption[] = shuffle([
    {
      key: "correct_reasoning",
      text: `You're right to challenge that. I used the wrong reasoning. ${names} is a brand-anchor SKU — its role is premium positioning and cross-sell, not velocity. I should have selected "Premium SKU for brand image" from the start.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: "I respect that you corrected it with data. We'll treat it as a brand-anchor SKU — different expectation, different shelf strategy.",
    },
    {
      key: "future_projection",
      text: `The ${vel} velocity reflects zero ad spend so far. Our projection, based on offline sell-through, is a 3x uplift once we activate Product Booster. This pitch is the catalyst.`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: "Risky assumption. I'll allow it but I want Week 1 CTR data before we continue at this scale.",
    },
    {
      key: "offline_data",
      text: `Our offline POS data from modern trade tells a different story. Blinkit quick-commerce velocity isn't representative of the full category picture for this SKU.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: "This is a Blinkit pitch. I care about Blinkit velocity. Noted as a risk — don't expect premium placement for this SKU.",
    },
  ]);

  return {
    id: "velocity_mismatch",
    cmMessage: pick(messages),
    dataCard: { title: "📊 SKU Velocity & Unit Economics", rows: velRows },
    responses,
  };
}

function buildDilutionPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const { cityStockMap, budget } = scenario;
  const allCities   = Array.from(new Set(pitched.flatMap((s) => s.cities)));
  if (allCities.length < 10) return null;

  const stockedCount   = allCities.filter((c) => (cityStockMap[c] ?? 0) > 0).length;
  const budgetPerState = Math.round(budget / allCities.length);
  const top3 = allCities
    .filter((c) => (cityStockMap[c] ?? 0) > 0)
    .sort((a, b) => (cityStockMap[b] ?? 0) - (cityStockMap[a] ?? 0))
    .slice(0, 3);

  const messages = [
    `You've pitched across ${allCities.length} states. Your total budget is ₹${budget.toLocaleString("en-IN")}. That's ₹${budgetPerState.toLocaleString("en-IN")} per state. At that level you don't hit frequency thresholds anywhere — you'll be invisible in every market. What's the actual strategy here?`,
    `${allCities.length} states with ₹${budget.toLocaleString("en-IN")}. Do the math — ₹${budgetPerState.toLocaleString("en-IN")} per state won't even clear minimum CPM thresholds in most markets. You'll be spreading butter so thin you can see through it. Convince me this works.`,
    `I'm looking at your geo coverage — ${allCities.length} states. Quick commerce rewards depth, not width. ₹${budgetPerState.toLocaleString("en-IN")} per state is not a strategy, it's a scatter shot. Where are you actually trying to win?`,
    `${allCities.length} states pitched. I've seen brands make this mistake — they go national on day one and end up with mediocre results everywhere. Your ₹${budget.toLocaleString("en-IN")} budget needs to be concentrated. Walk me through your thinking.`,
  ];

  const rows: DataCardRow[] = [
    { label: "States in pitch",             value: `${allCities.length}`,                              status: "bad" },
    { label: "States with stock",           value: `${stockedCount} of ${allCities.length}`,            status: stockedCount < allCities.length * 0.6 ? "bad" : "warn" },
    { label: "Effective budget per state",  value: `₹${budgetPerState.toLocaleString("en-IN")}`,        status: budgetPerState < 10000 ? "bad" : "warn" },
    { label: "Total campaign budget",       value: `₹${budget.toLocaleString("en-IN")}`,                status: "neutral" },
    ...(top3.length > 0 ? [{ label: "Top stocked states", value: top3.join(", "), status: "good" as const }] : []),
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "concentrate",
      text: `Completely valid. With ₹${budget.toLocaleString("en-IN")}, I should focus exclusively on ${top3.length > 0 ? top3.join(", ") : "our highest-OSA states"}. Concentrated spend drives frequency and ROAS — national coverage at this budget is a mistake. I'll narrow the pitch.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: "Now that's a plan. Concentration wins in quick commerce. Approved for the narrowed set.",
    },
    {
      key: "phased",
      text: `We'll run a phased approach — heavy concentration in our top 3 stocked states in Week 1, then expand with learnings. The pitch captures full scope but actual spend is front-loaded in the leaders.`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: "Phased makes sense if you actually execute it that way. I'll hold you to Week 1 being concentrated — don't dilute on Day 1.",
    },
    {
      key: "national_brand",
      text: `We're building national brand recall. CPMs in smaller states are lower, so broad coverage gives us efficient cost-per-impression at a national level.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: "Impressions without frequency don't build brand recall. You need to be seen 5–7 times in one market before going broad. This is the most common mistake I see from new brand managers.",
    },
  ]);

  return {
    id: "dilution",
    cmMessage: pick(messages),
    dataCard: { title: "💸 Budget Concentration Analysis", rows: rows },
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
    `Before I stamp this — there's a well-funded competitor actively bidding in your category right now. CPMs are 35% above normal baseline. That ₹${budget.toLocaleString("en-IN")} buys significantly fewer impressions than your plan assumes. How does your strategy hold up?`,
    `I need to tell you something before we go further. There's an aggressive competitor in your category — CPMs are up 35%. Your budget is ₹${budget.toLocaleString("en-IN")}. At elevated CPMs, that's materially fewer impressions. What's your defence?`,
    `Your timing is complicated. A well-capitalised competitor is actively outbidding in ${profile.category} right now — 35% CPM inflation. How does your pitch account for that pressure on your budget?`,
    `Let me share some market context before I decide. CPMs in your category are 35% elevated due to an aggressive competitor. Where exactly do you plan to win, and how does your budget hold up against that kind of pressure?`,
  ];

  const rows: DataCardRow[] = [
    { label: "Market condition",        value: "Aggressive Competitor Active",      status: "bad" },
    { label: "CPM inflation",           value: "+35% above baseline",               status: "bad" },
    { label: "Impression share risk",   value: "High — top positions contested",    status: "warn" },
    { label: "Your category",           value: profile.category,                    status: "neutral" },
    { label: "Your stocked strongholds",value: strongholds.join(", ") || "None",   status: strongholds.length > 0 ? "good" : "bad" },
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "defend_stronghold",
      text: `We'll narrow geo to ${strongholds.length > 0 ? strongholds.join(", ") : "our highest-OSA states"} where we have strong stock and are hardest to displace. We'll bid 30–35% higher on our hero SKU to protect impression share, and ignore states where the competitor is stronger.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: "Smart. Pick your battles and defend where you're strong. That's the right call in a CPM-inflated market.",
    },
    {
      key: "differentiate",
      text: `Our product differentiation should hold up even at elevated CPMs. Category-specific CVR tends to outperform broad competitors — we'll maintain our bids and monitor closely.`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: "Reasonable, but watch your ROAS daily. If it dips below 1.5x in Week 1, pull back and reassess geo coverage.",
    },
    {
      key: "proceed",
      text: `We'll proceed as planned and monitor. The competitor may not be active across all our target states — there could be gaps we can exploit.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: "Hoping for gaps is not a plan. Without active bid management, your budget will get squeezed. Noted as a risk.",
    },
  ]);

  return {
    id: "competition",
    cmMessage: pick(messages),
    dataCard: { title: "⚔️ Competitive Landscape", rows: rows },
    responses,
  };
}

function buildInventoryPushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  if (scenario.inventory.tone !== "critical" && scenario.inventory.tone !== "warning") return null;

  const { inventory, budget } = scenario;

  const messages = [
    `Before anything else — I'm looking at your inventory health. OSA ${inventory.osa}%, fill rate ${inventory.fillRate}%. If I push ads and customers can't find your product at checkout, they bounce and your brand takes the hit. Walk me through how you're going to prevent that.`,
    `I always check inventory health before approving ad spend. Your OSA is ${inventory.osa}% and fill rate is ${inventory.fillRate}%. Running a full campaign with these numbers is a customer experience risk. How are you thinking about this?`,
    `Your inventory situation is flagged in my system — OSA ${inventory.osa}%, fill rate ${inventory.fillRate}%. Ads drive traffic. If that traffic hits an out-of-stock wall, you've just paid to create a bad brand moment. What's the plan?`,
    `${inventory.label} inventory — OSA at ${inventory.osa}%, fill rate ${inventory.fillRate}%. I've seen brands burn their entire campaign budget driving clicks to products that weren't available. Convince me that won't happen here.`,
  ];

  const rows: DataCardRow[] = [
    { label: "Overall OSA",     value: `${inventory.osa}%`,         status: inventory.osa < 50 ? "bad" : "warn" },
    { label: "Fill rate",       value: `${inventory.fillRate}%`,     status: inventory.fillRate < 70 ? "bad" : "warn" },
    { label: "Active stores",   value: `${inventory.activeStores}`,  status: inventory.activeStores < 30 ? "bad" : "warn" },
    { label: "Aging units",     value: `${inventory.agingUnits}`,    status: inventory.agingUnits > 200 ? "bad" : "warn" },
    { label: "Status",          value: inventory.label,              status: inventory.tone === "critical" ? "bad" : "warn" },
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "limit_scope",
      text: `You're right to flag this. I'll restrict the campaign to only the states where OSA is above 70%, run on a Daily budget so spend is controlled, and limit it to our highest-margin SKU. Fixing supply chain in parallel — this is a targeted test, not a national push.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: "That's a responsible plan. Tight scope with good OSA coverage is exactly the right call when inventory is uncertain.",
    },
    {
      key: "small_test",
      text: `We'll run a small ₹20,000 test in 2 states with the strongest OSA to validate demand signals while the supply team fixes the broader situation. Proof of concept first.`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: "Small test is sensible. Keep it tight. Don't scale until OSA is consistently above 70%.",
    },
    {
      key: "push_anyway",
      text: `Running ads actually creates internal urgency to fix supply faster. The demand signal from the campaign will accelerate our supply chain work.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: "You don't fix supply by creating demand you can't fulfil. You just disappoint customers faster. This is a risk I'm putting on your account.",
    },
  ]);

  return {
    id: "inventory",
    cmMessage: pick(messages),
    dataCard: { title: "📋 Inventory Health Check", rows: rows },
    responses,
  };
}

// ─── Fill rate pushback ───────────────────────────────────────────────────────
/**
 * Triggers when the student pitches multiple states but the overall fill rate
 * is too low to sustainably replenish all of them.
 *
 * Key insight: fill rate × states pitched = states you can actually sustain.
 * If that number is materially less than what's pitched, the CM calls it out.
 *
 * Threshold: fillRate < 70 AND pitching more than 1 state.
 */
function buildFillRatePushback(pitched: PitchedSKU[], scenario: Scenario): Pushback | null {
  const { inventory, cityStockMap, profile } = scenario;
  const allCities = Array.from(new Set(pitched.flatMap((s) => s.cities)));

  // Only trigger when fill rate is a concern and student is pitching multiple states
  if (inventory.fillRate >= 70 || allCities.length <= 1) return null;

  const fillRate = inventory.fillRate;
  // Days of stock runway: initial OSA % acts as a proxy for current stock depth.
  // Replenishment (fill rate) refills at ~fillRate/4 % of capacity per week.
  // Net runway = initial days of coverage + replenishment over 30 days.
  // A state is "sustainable" when it can stay stocked through the full campaign.
  const stateRunways = allCities.map((c) => {
    const osa = cityStockMap[c] ?? 0;
    // Weekly replenishment as % of capacity: fillRate / 4 (monthly→weekly)
    const weeklyReplenish = fillRate / 4; // %
    // Starting stock as % capacity = osa. Over 30 days (4 weeks) replenishment adds 4×weeklyReplenish.
    // Depletion is estimated at ~40% of capacity/month with ads running (aggressive estimate).
    const projectedEndPct = osa + (weeklyReplenish * 4) - 40;
    const daysRunway = osa > 0 ? Math.round((Math.max(osa, projectedEndPct) / 100) * 30) : 0;
    return { city: c, osa, daysRunway, sustainable: osa > 0 && daysRunway >= 15 };
  });

  const sustainableCount = stateRunways.filter((r) => r.sustainable).length;
  const atRiskCount      = allCities.length - sustainableCount;

  // States with decent OSA — the most worth focusing on
  const stockedStates = allCities
    .filter((c) => (cityStockMap[c] ?? 0) >= 50)
    .sort((a, b) => (cityStockMap[b] ?? 0) - (cityStockMap[a] ?? 0));
  const commitTarget = stockedStates.slice(0, Math.max(1, sustainableCount));

  // Per-state sustainability breakdown for the data card
  const stateRows: DataCardRow[] = stateRunways.map(({ city: c, osa, daysRunway, sustainable }) => ({
    label: c,
    value: osa > 0 ? `${osa}% OSA · ~${daysRunway}d runway` : "0% OSA · no stock",
    status: sustainable ? "good" : osa > 0 ? "warn" : "bad",
  }));

  const summaryRows: DataCardRow[] = [
    { label: "Your fill rate",           value: `${fillRate}%`,           status: fillRate < 50 ? "bad" : "warn" },
    { label: "States pitched",           value: `${allCities.length}`,    status: "neutral" },
    { label: "Sustainably stockable",    value: `~${sustainableCount} states`, status: sustainableCount < allCities.length ? "warn" : "good" },
    { label: "At risk of going OOS",     value: `${atRiskCount} state${atRiskCount !== 1 ? "s" : ""}`, status: atRiskCount > 0 ? "bad" : "good" },
    ...(commitTarget.length > 0
      ? [{ label: "Recommended focus", value: commitTarget.join(", "), status: "good" as const }]
      : []),
  ];

  const messages = [
    `I want to talk about something before I approve this geo coverage. Your fill rate is ${fillRate}%. That means at your current replenishment capacity, you can sustainably stock roughly ${sustainableCount} of the ${allCities.length} states you've pitched. The other ${atRiskCount} will go out of stock mid-campaign — your ads will keep spending but shoppers will hit empty shelves. How are you handling this?`,
    `Fill rate check — ${fillRate}%. You've pitched ${allCities.length} states, but your supply chain can realistically sustain about ${sustainableCount}. I've seen this play out badly: brand spends the full budget, conversions collapse in Week 2 when stock runs out, ROAS tanks. Walk me through your replenishment plan.`,
    `I'm flagging a supply constraint before I approve. At ${fillRate}% fill rate across ${allCities.length} states, your stock runway in several of these markets is under 15 days. Once ads go live and demand picks up, you'll deplete faster. Which states are you actually prepared to sustain for 30 days?`,
    `Quick question before we go further — fill rate is ${fillRate}%. For ${allCities.length} states, that's not enough replenishment capacity to keep shelves stocked through a full 30-day campaign. I'd rather approve fewer states properly than all of them poorly. What's your actual commitment here?`,
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "commit_fewer",
      text: `You're right — I over-pitched on geo. Given the ${fillRate}% fill rate, I'll commit to ${commitTarget.length > 0 ? commitTarget.join(", ") : `${sustainableCount} states`} only. These have the highest OSA and I can confidently sustain them for 30 days. I'll expand once fill rate improves.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: `Good. Committing to fewer states with better supply discipline is always the right call. Approved for the ${commitTarget.length > 0 ? commitTarget.join(", ") : "narrowed"} set.`,
    },
    {
      key: "improve_fillrate",
      text: `We're working to improve fill rate — expecting to be at 75%+ within 2 weeks as a new warehouse shipment arrives. Can we proceed with current pitch and I'll flag immediately if any state goes below 60% OSA?`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: `I'll allow it on a short leash. If any state drops below 60% OSA in Week 1, I'm pausing that state's ads automatically. And I'm holding you to that fill rate improvement.`,
    },
    {
      key: "demand_pull",
      text: `Higher ad demand will actually accelerate our replenishment cycle — more sell-through signals stronger demand to our supply chain, which triggers faster restocking. It's a flywheel.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: `That's not how supply chains work in practice. You can't sell through stock you don't have. If fill rate is the constraint, demand signals don't fix it faster than your logistics capacity. I'm noting this as a risk.`,
    },
  ]);

  return {
    id: "fill_rate",
    cmMessage: pick(messages),
    dataCard: {
      title: "🔄 Fill Rate & Stock Sustainability",
      rows: [...summaryRows, ...stateRows],
    },
    responses,
  };
}

function buildNoReasoningPushback(pitched: PitchedSKU[], _scenario: Scenario): Pushback | null {
  const emptySkus = pitched.filter((s) => !s.reasoning || s.reasoning.trim() === "");
  if (emptySkus.length === 0) return null;

  const names = emptySkus.map((s) => s.skuName).join(", ");

  const messages = [
    `I'm looking at your pitch for ${names} and I don't see a business case. "Why should I give you shelf space?" is the most basic question in this meeting. Walk me through the rationale.`,
    `You've listed ${names} but given me no reason why. I approve pitches, not wishlists. What's the case for each SKU?`,
    `Hold on — ${names} with no stated rationale. I have three other brands waiting today, all with proper justifications. Why is yours worth my time?`,
    `${names}: I need to know WHY. Velocity? Margin? Strategic role? "Because we want shelf space" is not a pitch.`,
  ];

  const rows: DataCardRow[] = emptySkus.map((s) => ({
    label: s.skuName,
    value: "No reasoning provided",
    status: "bad" as DataCardRow["status"],
  }));

  const responses: ResponseOption[] = shuffle([
    {
      key: "strong_case",
      text: `Fair point — I should have led with this. This SKU is our margin anchor and category repeat-purchase driver. Its role isn't just volume — it builds basket size and drives the kind of second-visit behaviour that benefits the whole portfolio. I should have stated that clearly from the start.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: "That's a proper business case. Lead with it next time — don't make me ask.",
    },
    {
      key: "generic_case",
      text: `We're looking to drive awareness and trial for the brand on Blinkit. These SKUs represent our core range and we believe they have strong demand potential in quick commerce.`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: "Generic, but it's a start. I need more specific data before I give you premium placement.",
    },
    {
      key: "no_case",
      text: `These are our main products and we want them available on Blinkit. The demand is there — we just need the visibility.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: "That's not a pitch, that's a listing request. Business justification, not confidence. Noted as a weak case.",
    },
  ]);

  return {
    id: "no_reasoning",
    cmMessage: pick(messages),
    dataCard: { title: "❓ Missing Business Case", rows },
    responses,
  };
}

// ─── Offline presence pushback ───────────────────────────────────────────────
/**
 * Fires when a student pitches a SKU in states where offline MT/GT presence
 * is "weak" or "none", using a reasoning that isn't an explicit expansion play.
 *
 * "New market expansion" and "Strategic loss leader" are exempt — they signal
 * the student knows they're entering a new market.
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

  // Build data card: show ALL states pitched for flagged SKUs so student sees full picture
  const flaggedSkuIds = Array.from(new Set(badHits.map((h) => h.skuId)));
  const dataRows: DataCardRow[] = [];

  for (const skuId of flaggedSkuIds) {
    const ps = pitched.find((p) => p.skuId === skuId)!;
    for (const state of ps.cities) {
      const presence = getSkuStatePresence(profile, skuId, state as StateName);
      const label = ps.skuName.split(" ").slice(-3).join(" ") + " · " + state;
      const value =
        presence === "strong"   ? "MT sell-through: Strong ✓✓" :
        presence === "moderate" ? "MT sell-through: Moderate ✓"  :
        presence === "weak"     ? "MT sell-through: Weak (~5%)"  :
                                  "No offline presence";
      const status: DataCardRow["status"] =
        presence === "strong" ? "good" : presence === "moderate" ? "warn" : "bad";
      dataRows.push({ label, value, status });
    }
  }

  const badStateNames   = Array.from(new Set(badHits.map((h) => h.state)));
  const badSkuShortNames = Array.from(new Set(badHits.map((h) => h.skuName.split(" ").slice(-3).join(" "))));
  const worstPresence   = badHits.some((h) => h.presence === "none") ? "none" : "weak";
  const goodStates = Array.from(
    new Set(
      pitched.flatMap((ps) =>
        ps.cities.filter((c) => {
          const p = getSkuStatePresence(profile, ps.skuId, c as StateName);
          return p === "strong" || p === "moderate";
        })
      )
    )
  ).slice(0, 3);

  const reasoning = pitched.find((p) => badHits.some((b) => b.skuId === p.skuId))?.reasoning ?? "this reasoning";

  const messages = [
    `I'm pulling our offline scan data before I approve these states. ${badSkuShortNames.join(" and ")} in ${badStateNames.join(", ")} — MT sell-through is ${worstPresence === "none" ? "essentially zero" : "below 5%"}. Quick commerce converts existing offline demand into a faster channel — it doesn't create demand from scratch. Where's your proof of demand here?`,
    `Hold on. ${badSkuShortNames.join(" and ")} — "${reasoning}" — but I'm looking at our modern trade data for ${badStateNames.join(", ")}: ${worstPresence === "none" ? "no offline presence at all" : "very weak MT sell-through"}. If customers haven't bought this offline, why would they add it to their Blinkit cart in ${badStateNames.length > 1 ? "those states" : "that state"}?`,
    `Before I approve ${badStateNames.join(", ")} — I need to flag something. Our offline data shows ${worstPresence === "none" ? "zero market presence" : "weak MT penetration"} for ${badSkuShortNames.join(" and ")} there. Blinkit shelf space is expensive. If there's no offline proof of demand, I'm essentially fronting your market exploration cost. Walk me through your data.`,
    `I'll be direct: ${badStateNames.join(", ")} for ${badSkuShortNames.join(" and ")} — offline presence is ${worstPresence === "none" ? "nonexistent" : "weak"}. You've picked "${reasoning}" as your rationale, but that doesn't hold up for markets where we have no sell-through history. What's actually driving your confidence here?`,
  ];

  const responses: ResponseOption[] = shuffle([
    {
      key: "restrict_to_proven",
      text: `You're right — I should have caught this. I'll restrict these SKUs to states where we have proven offline demand${goodStates.length > 0 ? ` — ${goodStates.join(", ")}` : ""}. Including states without any MT sell-through history was overreaching.`,
      quality: "strong",
      scoreImpact: 3,
      cmAck: `That's the right call. Blinkit amplifies existing demand — it doesn't generate new demand. Approved for your core markets only.`,
    },
    {
      key: "new_market_case",
      text: `I hear you. We're intentionally targeting ${badStateNames.slice(0, 2).join(" and ")} as expansion markets — the brand hasn't established offline there yet, and we're using Blinkit to pioneer. The intent is new market entry, not scaling existing demand.`,
      quality: "ok",
      scoreImpact: 1,
      cmAck: `I'll accept new market expansion as a rationale. But I'm giving you minimal inventory in those states until Week 2 data shows proof of demand. Don't expect premium placement there.`,
    },
    {
      key: "online_different_claim",
      text: `Our quick-commerce customer is a different segment from offline MT shoppers. The Blinkit buyer in ${badStateNames[0] ?? "those states"} may not be captured in MT data at all — it's a different channel with different demand drivers.`,
      quality: "weak",
      scoreImpact: -1,
      cmAck: `That's a convenient theory with no data behind it. Channels overlap more than you think. Without offline proof of demand, you're asking me to take a speculative risk. I'm flagging these states as high-risk on your account.`,
    },
  ]);

  return {
    id: "offline_presence",
    cmMessage: pick(messages),
    dataCard: { title: "📊 Offline Market Presence (MT Sell-Through)", rows: dataRows },
    responses,
  };
}

// ─── buildPushbacks ──────────────────────────────────────────────────────────
/**
 * Generates up to 3 pushbacks for this pitch session.
 *
 * Variety mechanisms:
 *   1. Each builder picks one message variant at random from its pool.
 *   2. Response option order is shuffled inside each builder.
 *   3. When more than 3 pushbacks are eligible, the set is shuffled before
 *      slicing — so different issues surface on different attempts.
 */
export function buildPushbacks(pitched: PitchedSKU[], scenario: Scenario): Pushback[] {
  // Inventory + fill rate cover the same root problem — only fire the more severe one.
  const invPb      = buildInventoryPushback(pitched, scenario);
  const fillRatePb = buildFillRatePushback(pitched, scenario);
  const inventoryOrFillRate: Pushback | null =
    invPb && fillRatePb
      ? scenario.inventory.tone === "critical" ? invPb : fillRatePb
      : invPb ?? fillRatePb ?? null;

  // Build all eligible pushbacks
  const candidates: (Pushback | null)[] = [
    buildZeroStockPushback(pitched, scenario),
    buildOfflinePresencePushback(pitched, scenario),
    buildVelocityPushback(pitched, scenario),
    buildNoReasoningPushback(pitched, scenario),
    inventoryOrFillRate,
    buildDilutionPushback(pitched, scenario),
    buildCompetitorPushback(pitched, scenario),
  ];

  const eligible = candidates.filter((p): p is Pushback => p !== null);

  // zero_stock and offline_presence are always surfaced first (most critical data errors).
  // Everything else is shuffled so order varies across retry attempts.
  const zeroStock       = eligible.filter((p) => p.id === "zero_stock");
  const offlinePresence = eligible.filter((p) => p.id === "offline_presence");
  const rest            = shuffle(eligible.filter((p) => p.id !== "zero_stock" && p.id !== "offline_presence"));
  const ordered         = [...zeroStock, ...offlinePresence, ...rest];

  return ordered.slice(0, 3);
}

// ─── Opening message ─────────────────────────────────────────────────────────

export function buildOpeningMessage(
  pitched: PitchedSKU[],
  scenario: Scenario,
): { message: string; dataCard: DataCard } {
  const { cityStockMap, profile } = scenario;
  const allCities     = Array.from(new Set(pitched.flatMap((s) => s.cities)));
  const stockedCities = allCities.filter((c) => (cityStockMap[c] ?? 0) > 0);
  // Cities with 0 OSA but committed stock count as "planned" not "issues"
  const zeroCities    = allCities.filter((c) => (cityStockMap[c] ?? 0) === 0);
  const committedInOpening = zeroCities.filter((c) =>
    pitched.some((s) => (s.stockCommitments?.[c] ?? 0) > 0)
  );
  const issues = zeroCities.length - committedInOpening.length; // only uncommitted 0-OSA states are real issues

  // Aggregate committed units across all pitched SKUs per city
  const totalCommitments: Record<string, number> = {};
  for (const s of pitched) {
    for (const city of allCities) {
      const units = s.stockCommitments?.[city] ?? 0;
      if (units > 0) totalCommitments[city] = (totalCommitments[city] ?? 0) + units;
    }
  }

  // Per-state OSA rows — CM reviews each pitched state individually
  const stateOsaRows: DataCardRow[] = allCities.map((c) => {
    const osa     = cityStockMap[c] ?? 0;
    const commit  = totalCommitments[c] ?? 0;
    if (osa === 0 && commit > 0) {
      return { label: `${c} (new)`, value: `No stock → ${commit.toLocaleString("en-IN")} units committed`, status: "warn" };
    }
    const status: DataCardRow["status"] = osa >= 70 ? "good" : osa >= 30 ? "warn" : "bad";
    return { label: c, value: osa > 0 ? `${osa}% OSA` : "No stock", status };
  });

  const rows: DataCardRow[] = [
    { label: "SKUs pitched",    value: pitched.map((s) => s.skuName).join(", ") || "None", status: pitched.length > 0 ? "neutral" : "bad" },
    { label: "Category",        value: profile.category, status: "neutral" },
    { label: "Campaign budget", value: `₹${scenario.budget.toLocaleString("en-IN")}`, status: "neutral" },
    // divider-style header row
    { label: "── State OSA ──", value: `${stockedCities.length}/${allCities.length} stocked`, status: stockedCities.length === allCities.length ? "good" : stockedCities.length > 0 ? "warn" : "bad" },
    ...stateOsaRows,
  ];

  const cleanMessages = [
    `Alright, I've got your ${profile.name} pitch. Let me pull up the data before I commit to anything.`,
    `Okay, I've reviewed the ${profile.name} submission. The numbers look clean at first glance — let me dig into a few things.`,
    `Right, ${profile.name}. I've got your pitch in front of me. Let me run through this properly before I give you an answer.`,
  ];

  const issueMessages = [
    `Alright, I've got your ${profile.name} pitch. I'm already seeing ${issues} state${issues > 1 ? "s" : ""} flagged — let me walk you through my concerns.`,
    `I've reviewed the ${profile.name} submission. Before I say anything positive, there are ${issues} issue${issues > 1 ? "s" : ""} I need you to address.`,
    `${profile.name} — I've got the pitch. I'm going to be direct with you: I have ${issues} concern${issues > 1 ? "s" : ""} before I can approve anything.`,
  ];

  const emptyMessage = `You haven't pitched any SKUs. I can't approve an empty submission — go back and build a proper pitch.`;

  let message: string;
  if (pitched.length === 0)  message = emptyMessage;
  else if (issues > 0)       message = pick(issueMessages);
  else                        message = pick(cleanMessages);

  return { message, dataCard: { title: "📋 Your Pitch Summary", rows } };
}

// ─── calcFinalResult ─────────────────────────────────────────────────────────

export function calcFinalResult(
  pitched: PitchedSKU[],
  scenario: Scenario,
  pushbacks: Pushback[],
  responses: Record<string, string>,
): CmPitchResult {
  const { cityStockMap, profile } = scenario;

  // Base pitch quality
  const flags: string[] = [];
  const allCities = Array.from(new Set(pitched.flatMap((s) => s.cities)));

  const zeroStockCities = allCities.filter((c) => (cityStockMap[c] ?? 0) === 0);
  // Aggregate committed units across all SKUs per city
  const allCommitments: Record<string, number> = {};
  for (const s of pitched) {
    for (const city of zeroStockCities) {
      allCommitments[city] = (allCommitments[city] ?? 0) + (s.stockCommitments?.[city] ?? 0);
    }
  }
  const committedZeroCities   = zeroStockCities.filter((c) => (allCommitments[c] ?? 0) > 0);
  const uncommittedZeroCities = zeroStockCities.filter((c) => (allCommitments[c] ?? 0) === 0);
  if (uncommittedZeroCities.length > 0)
    flags.push(`Pitched ${uncommittedZeroCities.length} state${uncommittedZeroCities.length > 1 ? "s" : ""} with zero stock and no commitment`);
  if (committedZeroCities.length > 0)
    flags.push(`Committed stock in ${committedZeroCities.length} new state${committedZeroCities.length > 1 ? "s" : ""} — timeline unverified`);

  pitched.forEach((s) => {
    if ((s.velocity === "Low" || s.velocity === "Very Low") && s.reasoning === "Proven high velocity offline") {
      flags.push(`Claimed high velocity for ${s.skuName} (actual: ${s.velocity})`);
    }
    if (!s.reasoning || s.reasoning.trim() === "") flags.push(`${s.skuName}: no reasoning provided`);
    if (s.cities.length === 0) flags.push(`${s.skuName}: no states selected`);

    // Offline presence mismatch — exempt expansion reasons
    if (!OFFLINE_EXPANSION_REASONS.includes(s.reasoning)) {
      const noneStates = s.cities.filter((c) => getSkuStatePresence(profile, s.skuId, c as StateName) === "none");
      if (noneStates.length > 0) {
        const shortName = s.skuName.split(" ").slice(-3).join(" ");
        flags.push(`${shortName}: no offline presence in ${noneStates.slice(0, 2).join(", ")}${noneStates.length > 2 ? ` +${noneStates.length - 2} more` : ""}`);
      }
    }
  });

  if (allCities.length >= 12) flags.push("Pitched in too many states — budget dilution risk");
  if (pitched.length === 0)   flags.push("No SKUs pitched");

  let baseScore = 9 - flags.length * 2;
  baseScore = Math.max(0, Math.min(9, baseScore));

  // Defense quality
  let defenseScore = 0;
  pushbacks.forEach((pb) => {
    const chosen = pb.responses.find((r) => r.key === responses[pb.id]);
    if (chosen) defenseScore += chosen.scoreImpact;
  });

  let pitchScore = Math.max(0, Math.min(15, baseScore + defenseScore));

  // ── Hard caps for uncaught severe flags ──────────────────────────────────
  // These are errors that defence alone cannot fix — a student who includes
  // zero-stock states with no commitment, or submits with no reasoning,
  // cannot score "strong" regardless of how well they answer pushbacks.
  const hasEmptyReasoning = pitched.some((s) => !s.reasoning || s.reasoning.trim() === "");
  if (uncommittedZeroCities.length >= 2) {
    // Two or more zero-stock states with no commitment → max "weak"
    pitchScore = Math.min(pitchScore, 7);
  } else if (uncommittedZeroCities.length === 1) {
    // One uncommitted zero-stock state → max "decent"
    pitchScore = Math.min(pitchScore, 11);
  }
  if (hasEmptyReasoning) {
    // Submitted with no reasoning on any SKU → max "decent"
    pitchScore = Math.min(pitchScore, 11);
  }

  // Status
  let status: CmPitchResult["status"];
  let message: string;
  let osaBoost = false;

  if (pitched.length === 0) {
    status = "rejected";
    message = "You submitted an empty pitch. Come back when you have a business case to present.";
  } else if (pitchScore >= 12) {
    status = "strong"; osaBoost = true;
    message = `Strong pitch. You understood the data and made the right calls when I pushed back. Premium shelf placement granted with a 10% OSA boost in approved states.`;
  } else if (pitchScore >= 8) {
    status = "decent";
    message = `Decent pitch. Some gaps, but the core business case is there. Standard shelf placement approved.`;
  } else if (pitchScore >= 4) {
    status = "weak";
    message = `Weak pitch. Real issues in the data and your defence wasn't convincing. Minimal shelf placement — I'll be watching Week 1 closely.`;
  } else {
    status = "rejected";
    message = `This pitch doesn't hold up. Too many data errors. Accept the default or re-pitch with better preparation.`;
  }

  const removedZeroStock   = responses["zero_stock"] === "remove";
  // committed + defended strongly → those cities get approved
  const committedApproved  = ["firm_timeline", "phased_launch"].includes(responses["zero_stock"] ?? "")
    ? committedZeroCities
    : [];
  const approvedSKUs      = status === "rejected" ? [] : pitched.map((s) => s.skuId);
  const approvedCities    =
    status === "rejected"
      ? []
      : Array.from(new Set(
          pitched.flatMap((s) =>
            s.cities.filter((c) => {
              const osa = cityStockMap[c] ?? 0;
              if (osa === 0) {
                // only approve if student committed stock AND defended credibly
                return committedApproved.includes(c);
              }
              // fully stocked cities — approve unless student said "remove" (which means they chose to drop zero-stock states)
              if (removedZeroStock) return true; // "remove" only drops zero-OSA, keeps stocked
              return true;
            })
          )
        ));

  return { status, approvedSKUs, approvedCities, pitchScore, osaBoost, message, flags };
}

// ─── Relationship bootstrap ──────────────────────────────────────────────────
/**
 * Converts a pitch score (0–15) into the initial CM relationship score (0–100).
 * Called once by SimContext when setCmPitch is called.
 *
 * Tiers (for reference — consequences wired up during simulation accuracy phase):
 *   Trusted  65–100 : CM proactively helps, fast expansions
 *   Neutral  40–64  : Standard behaviour
 *   Strained 20–39  : Expansions slower / cost more tokens
 *   Broken    0–19  : Expansion locked, shelf placement at risk
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

// ─── CM closing message ──────────────────────────────────────────────────────

export function buildClosingMessage(result: CmPitchResult, brandName: string): string {
  if (result.status === "strong") {
    return pick([
      `Alright ${brandName} — we're good. Premium placement, 10% OSA boost in approved states. Don't waste it. I want strong ROAS in Week 1.`,
      `I'm signing off on a strong approval. Premium shelf, OSA boost. Execute well — I'll be watching the numbers personally.`,
      `Good pitch, well defended. Premium placement granted. Now go build the campaigns to back it up.`,
    ]);
  }
  if (result.status === "decent") {
    return pick([
      `Standard approval. You had some weak spots but the core case is there. Earn more shelf next quarter with better execution.`,
      `I'm signing off — standard placement. Not a perfect pitch but good enough. Let the results speak.`,
      `Approved at standard level. You made some questionable calls today, but I've seen worse. Execute and improve.`,
    ]);
  }
  if (result.status === "weak") {
    return pick([
      `Letting this through on a short leash. Limited placement. Real issues in this pitch — Week 1 numbers will decide what happens next.`,
      `Minimal approval. The pitch had too many gaps. I'll review your Week 1 performance before I give you anything more.`,
      `I'm giving you the minimum here. This pitch was not well-prepared. Fix the data issues and come back stronger next time.`,
    ]);
  }
  return pick([
    `I can't approve this as submitted. Accept the default for your hero SKU, or use a token to re-pitch with better preparation.`,
    `This pitch doesn't work. Too many errors. Take the default approval or go back and start over.`,
    `Rejected. The data doesn't support what you've pitched. Accept the minimum default or re-pitch properly.`,
  ]);
}
