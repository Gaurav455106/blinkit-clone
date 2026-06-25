# Blinkit Simulation — Dependency Reference

> This file is the **single source of truth** for how all modules connect.  
> Claude: read this before touching any logic file. Do NOT re-read individual files to understand structure — it's all here.

---

## 1. Data Flow (End-to-End)

```
scenarios.ts (profile + generated scenario)
    ↓
Brief.tsx          — displays brand, goals, stock map, quiz
    ↓
CM Pitch           — cm.osaBoost + cm.approvedCities → effectiveStockMap
    ↓
CampaignForm.tsx   — 5-step wizard → SavedCampaign[]
    ↓
simulateRun()      — simResults.ts → SimRunResult
    ↓
scoring.ts         — score() → ScoreResult (legacy; decisionScore is in simResults.ts)
    ↓
Day30Results.tsx   — renders final verdict
```

---

## 2. Key Types (all in `src/data/scenarios.ts`)

```ts
type GoalType = "ROAS-First" | "Awareness-First" | "Category-Creation" | "Volume-First" | "Inventory-Clearance";
type BrandLifecycle = "Acquire" | "Convert" | "Retain";
type StateName = string;   // e.g. "Karnataka", "Maharashtra"
type CityName = StateName;

interface GoalMetric { label: string; target: number; unit: string; }

interface ClientGoals {
  primary: string;
  performanceGoals: GoalMetric[];  // → needs conversion campaigns (Product Booster, Rec Ads)
  reachGoals: GoalMetric[];        // → needs awareness campaigns (Listing Spotlight, Brand Booster, Stories)
  metrics: GoalMetric[];           // union of both — used by simResults.ts goalRows
  threshold: string;
  lifecycle: BrandLifecycle;
  campaignHint: string;
}

interface Scenario {
  seed: string;
  profile: BrandProfile;
  cityStockMap: Record<StateName, number>;  // OSA % per state, 0 = no stock
  season: { name: string; note: string; implication: string };
  market: { name: string; note: string; implication: string };
  inventory: { id: string; label: string; osa: number; fillRate: number; activeStores: number; agingUnits: number; tone: "healthy"|"warning"|"critical"|"overstocked" };
  budget: number;  // always 200000
  clientGoals: ClientGoals;
  scheduledCrisis: { day: number; eventId: string; reason: string };
  city: StateName;
}

interface SavedCampaign {
  id: string; name: string;
  objective: "performance" | "reach";
  adFormat: string;          // one of the 5 ad formats
  cities: string[];          // state names
  skuIds: string[];
  keywords: string[];
  budget: number;
  budgetType: "daily" | "overall";
  geography: "pan_india" | "select_cities";
  launchDay?: number;
  dayparting?: number[];
  daypartPreset?: string;
}
```

---

## 3. Format Buckets (`src/lib/scoring.ts`)

```ts
AWARENESS_FORMATS  = ["listing_spotlight", "brand_booster", "stories"]
CONVERSION_FORMATS = ["product_booster", "recommendation_ads"]

requiredBuckets(goalType):
  "Awareness-First" | "Category-Creation"   → "awareness"
  "ROAS-First" | "Inventory-Clearance"       → "conversion"
  "Volume-First"                             → "both"

isAwarenessFormat(fmt)   // null-safe
isConversionFormat(fmt)  // null-safe
```

**Rule: never hardcode format names anywhere else — always call isAwarenessFormat / isConversionFormat.**

---

## 4. Simulation Engine (`src/lib/simResults.ts`)

### Stock delivery — critical rules
- Blinkit only serves ads where OSA > 0. Zero-OSA state = zero impressions AND zero spend.
- CM pitch with `osaBoost=true` multiplies OSA ×1.1 in approved cities (capped at 100), but cannot create stock where there is none (0 stays 0).

```ts
function buildEffectiveStockMap(scenario, cm):
  // Starts from scenario.cityStockMap
  // Applies cm.osaBoost ×1.1 to cm.approvedCities (only if stock > 0)
  // Returns: Record<state, OSA%>

function effectiveDelivery(stockMap, cities):
  // stockedCities = cities.filter(c => stockMap[c] > 0)
  // avgOsa  = mean(stockMap[c]) / 100 for stocked cities only   ← NOT averaged with 0s
  // stateScale = stockedCities.length / cities.length
  // Returns: { avgOsa, stateScale, stockedCities }
```

### Impression formula
```ts
impressions = round(
  baseImp       // = campaign.budget × 100
  × stateScale  // fraction of selected states that have stock
  × avgOsa      // stock quality in those states
  × objectiveMatch  // 1.3 if correct objective, 0.6 if wrong
  × cmBonus     // 1.15 if strong CM, 1.0 otherwise
  × competitorDrag  // 0.7 if Aggressive Competitor market, 1.0 otherwise
  × seasonMult  // Festival Surge 1.3, Post-Festival Slowdown 0.7, else 1.0
)
```

### Click / conversion formula
```ts
kwQuality  = keywords.length === 0 ? 1 : (goodHits >= riskyHits ? 1.5 : 0.5)
formatMatch = adFormat === profile.optimalAdFormat ? 1.3 : 0.7
ctr    = 0.012 × kwQuality × formatMatch    // keywords affect CTR, NOT impression volume
clicks = round(impressions × ctr)
atcs   = round(clicks × 0.25 × avgOsa)     // avgOsa gates conversions too
units  = round(atcs × 0.6)
spend  = min(budget, round((impressions/1000) × 80 × competitorDrag))
revenue = units × avgMrp
roas    = revenue / spend
```

### Decision Score labels and max points
| Label | Max | Key driver |
|-------|-----|------------|
| Brief comprehension | 8 | objective matches brand's optimalObjective |
| CM Pitch quality | 8 | cm.pitchScore (capped at 8) |
| Campaign Architecture | 10 | archScore from phase3.ts; **halved if required bucket not covered** |
| Launch Sequencing | 5 | phase3.ts detectSequence |
| Keyword Cannibalization | 5 | phase3.ts detectCannibalization |
| Pin-Code Cluster Reactions | 5 | clusterReactions.length > 0 → 5, else 2 |
| Creative / A/B Testing | 3 | phase3.ts scoreAbTests |
| Dayparting Strategy | 8 | fixed 7 currently |
| Weekly Optimization | 12 | fixed 10 currently |
| Event Responses | 16 | fixed 12 currently |
| Stock Management | 8 | noBadCities (uses effectiveStockMap) → 7, else 3 |
| Token Economy | 5 | phase3.ts scoreTokenEconomy |
| Budget Allocation | 5 | kwGood (≥60% good keywords) → 5, else 3 |
| Goal Achievement | 2 | achievementPct ≥90 → 2, ≥70 → 1, else 0 |

### Bucket coverage logic (Campaign Architecture score)
```ts
requiredBucket = requiredBuckets(scenario.profile.goalType)
hasAwarenessCampaign  = campaigns.some(c => isAwarenessFormat(c.adFormat))
hasConversionCampaign = campaigns.some(c => isConversionFormat(c.adFormat))

bucketCovered:
  "awareness"  → hasAwarenessCampaign
  "conversion" → hasConversionCampaign
  "both"       → hasAwarenessCampaign && hasConversionCampaign

// Campaign Architecture earned = bucketCovered ? archScore : floor(archScore / 2)
```

### Goal → metric mapping (goalRows)
```
"ROAS"                    → totals.roas
"Units sold" / "Units"    → totals.units
"Sell-through"            → totals.sellThrough
"Impressions"             → totals.impressions
"CTR"                     → totals.ctr
"Branded search lift"     → totals.brandedLift
"Reach"                   → totals.reach
"Category awareness lift" → round(brandedLift × 0.7)
"CVR"                     → totals.cvr
"Repeat purchase"         → min(40, units/50)
"Reduce aging units"      → totals.units
"Minimum ROAS"            → totals.roas
```
`achievementPct` = avg of all goalRow.pct values (each capped at 150).

---

## 5. Brand Profiles (hardcoded in `src/data/scenarios.ts`)

| id | name | goalType | optimalObjective | optimalAdFormat | primaryState | lifecycle |
|----|------|----------|-----------------|-----------------|--------------|-----------|
| henlo | Henlo | ROAS-First | performance | product_booster | Karnataka | Convert |
| glow | Glow Republic | Awareness-First | reach | listing_spotlight | Maharashtra | Acquire |
| vitaboost | VitaBoost | Category-Creation | reach | listing_spotlight | Delhi | Acquire |
| tinybuddy | TinyBuddy | Volume-First | reach | brand_booster | Delhi | Convert |
| munchbox | MunchBox | ROAS-First | performance | product_booster | Maharashtra | Convert |
| pawlife | PawLife | Awareness-First | reach | recommendation_ads | Karnataka | Acquire |
| fuelup | FuelUp | ROAS-First | performance | product_booster | Delhi | Convert |

> Note: `optimalObjective` drives impression multiplier (1.3 correct / 0.6 wrong).  
> `optimalAdFormat` drives CTR multiplier (1.3 match / 0.7 mismatch) and also awards max 15 pts in formatScore.

---

## 6. ClientGoals by GoalType (`generateClientGoals` in `src/data/scenarios.ts`)

| goalType | lifecycle | performanceGoals | reachGoals | requiredBucket |
|----------|-----------|-----------------|------------|----------------|
| ROAS-First | Convert | ROAS(3x), Units, Sell-through | Reach | conversion |
| Awareness-First | Acquire | CTR, small units | Impressions, Branded lift | awareness |
| Category-Creation | Acquire | tiny units | Impressions, Category lift | awareness |
| Volume-First | Convert | ROAS, Units | Reach | both |
| Inventory-Clearance | Retain | Sell-through, Reduce aging, Min ROAS | (empty) | conversion |

**`metrics` field = union of performanceGoals + reachGoals** — consumed by simResults.ts goalRows.

---

## 7. Season & Market Modifiers

```ts
SEASONS:
  "Normal Week"          → seasonMult 1.0 | implication: "Stable CPMs..."
  "Festival Surge"       → seasonMult 1.3 | implication: "CPMs rising fast..."
  "Pre-Festival Build"   → seasonMult 1.2 | implication: "Demand building..."
  "Post-Festival Slowdown" → seasonMult 0.7 | implication: "Demand falling..."
  "New Year Push"        → seasonMult 1.15 | implication: "Healthy bump..."

MARKET_CONDITIONS:
  "Stable Market"        → competitorDrag 1.0 | implication: "No unusual pressure..."
  "Aggressive Competitor" → competitorDrag 0.7 | implication: "Need 25-35% higher bids..."
  "Category Leader Entry" → competitorDrag 0.85 | implication: "Differentiate fast..."
  "New Blinkit Cluster"  → competitorDrag 1.0 | implication: "Fresh demand..."
  "Dark Store Expansion" → competitorDrag 1.05 | implication: "New delivery zones..."
```

---

## 8. Inventory Tones and Implications

| tone | label | implication (shown in Brief.tsx) |
|------|-------|----------------------------------|
| healthy | Healthy | "Good stock — scale confidently" |
| warning | Warning | "Patchy stock — narrow geo to stocked states" |
| critical | Critical | "Critical OSA — fix before running reach campaigns" |
| overstocked | Overstocked | "Too much stock — conversion/clearance priority" |

`inventoryImplication(tone)` is a pure function in `Brief.tsx` — not stored in scenarios.ts.

---

## 9. Brief.tsx Features (current state)

| Section | What it shows | Data source |
|---------|--------------|-------------|
| Brand header | name, category, difficulty, goalType badge, lifecycle badge, budget | profile + clientGoals.lifecycle |
| Client goals | Two-column split: orange (Conversion Targets → PB/RecAds) + blue (Reach Targets → LS/BB/Stories) | clientGoals.performanceGoals + reachGoals |
| Campaign strategy hint | Text hint on what mix to run | clientGoals.campaignHint |
| Stock map table | OSA per stocked state, city-level breakdown, status badge | scenario.cityStockMap + stockedStates() |
| Stock warning | "Budget under-delivers, not wasted" correction | static copy |
| Context cards | Season / Market / Inventory each with actionable 💡 implication | season.implication, market.implication, inventoryImplication(inventory.tone) |
| SKU portfolio | MRP, margin, velocity + campaign role guidance | profile.skus |
| Keyword preview | Green chips (goodKeywords) + red chips (riskyKeywords) | profile.goodKeywords, profile.riskyKeywords |
| Budget split planner | Two ₹ inputs → localStorage sim_budget_intent_conversion + sim_budget_intent_reach | local state + localStorage |
| Comprehension quiz | Q1: primary objective (3 options), Q2: highest-stock state (3 options). Both must be correct to unlock Continue | quiz built from goalType + cityStockMap |

**Continue button is gated on quiz passing.** Budget split is optional (not required to continue).

---

## 10. localStorage Keys Added in Recent Sessions

| Key | Type | Purpose |
|-----|------|---------|
| `sim_budget_intent_conversion` | string (number) | Student's planned conversion budget from Brief quiz |
| `sim_budget_intent_reach` | string (number) | Student's planned reach budget from Brief quiz |
| `sim_brief_ack` | "1" | Set when student completes Brief and continues |

(For the complete legacy key list, see CLAUDE.md §localStorage Key Reference.)

---

## 11. Test Suite (`src/lib/__tests__/simulation.test.ts`)

Run with: `npm test`

**What's tested (31 tests):**

| Suite | Tests |
|-------|-------|
| Format buckets | classifies correctly, no cross-classification, null-safe |
| requiredBuckets | all 5 GoalTypes → correct bucket |
| OSA & stock delivery | strong CM boosts impressions, zero-OSA = 0 impressions + 0 spend, Pan India vs Select States |
| OSA scoring | noBadCities → higher Stock Management score |
| Campaign Architecture (bucket) | ROAS-First only conversion = full score, Awareness-First with conversion = penalised, Volume-First both = full, Volume-First awareness only = penalised |
| ClientGoals structure | all 7 brands have required fields, metrics = union |
| Smoke test | all 7 brands produce valid simulateRun() output |
| Score direction | optimal format > wrong, good kw → more clicks/units, strong CM > weak CM, correct objective > wrong |

**Run this after every logic change.** Zero failures expected on a clean codebase.

---

## 12. Phase 3 Module (`src/lib/phase3.ts`)

Used by simResults.ts for advanced scoring. Functions:

```ts
detectArchitecture(campaigns)          → architecture letter (A/B/C/D/E)
optimalArchitecture(scenario, brandId) → { optimal, alternative }
scoreArchitecture(detected, opt, alt)  → number (0-10)
detectSequence(campaigns)              → sequence descriptor
scoreSequence(brandId, seq)            → { score, note }
detectCannibalization(campaigns)       → pairs of overlapping keyword campaigns
scoreCannibalization(pairs, resolved)  → number (0-5)
scoreAbTests(abTests)                  → number (0-3)
scoreTokenEconomy(tokensSpent)         → number (0-5)
```

---

## 13. Rules That Must Never Break

1. **MIN_BID = ₹200** for all keyword and category bids (enforced in ProductBoosterTargeting.tsx)
2. **Zero-OSA = zero spend AND zero delivery** — never mix this up (confirmed by tests)
3. **`metrics` in ClientGoals = union** of performanceGoals + reachGoals — scoring engine reads from `metrics`
4. **`effectiveStockMap` must be built before any campaign metric** — CM boost must be applied first
5. **`useLocalStorage` for all state that crosses wizard steps** — never use useState for cross-step persistence
6. **`useSim()` for scenario/campaigns/tokens** — the single source of global truth
7. **`showCategoryTargeting={false}`** → disables category in ProductBoosterTargeting (Recommendation Ads)
8. **`showAdSchedule={true}`** → only pass for Stories ad type
9. **No `overflow-hidden` on card parents that contain dropdowns** — breaks z-index
10. **Budget alert on Overall budget violation → stay on budget step, no navigation**
11. **Brief → Continue gated on quiz** — both questions correct required; budget split is optional
12. **After any scoring logic change, run `npm test`** — 31 tests must all pass
