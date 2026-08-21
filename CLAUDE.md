# Blinkit Ads Simulation — Claude Reference

## Dependency Reference
> **For all logic, scoring formulas, brand profiles, and module interconnections — read `DEPENDENCIES.md` first.**  
> CLAUDE.md covers project structure; DEPENDENCIES.md covers how everything calculates and connects.

> ⚠️ **Never use bare `npx tsc --noEmit`.** The root `tsconfig.json` is a solution
> file (`"files": []` + project references), so that command checks **zero files**
> and always exits 0 — it silently reports success no matter what is broken.
> Use `npm run typecheck` (= `tsc -p tsconfig.app.json --noEmit`).

---

## Purpose
A training simulation of the Blinkit advertising platform for student marketers. Students play a brand manager: read a brand brief, pitch a CM, build ad campaigns, run a 30-day simulation, face crises, and get a scored result. Everything is interconnected — brief → CM pitch → campaigns → simulation engine → results.

## Commands
```bash
npm run dev        # start dev server (localhost:5173)
npm run typecheck  # type-check — run after every code change
npm run build      # production build
```

---

## Tech Stack
- **React 18 + TypeScript + Vite**
- **Tailwind CSS + shadcn/ui** (`src/components/ui/`)
- **Supabase** for cloud sync (run sessions, leaderboard)
- **localStorage** for all in-session state (keys prefixed `sim_`)
- `useLocalStorage` hook (`src/hooks/useLocalStorage.ts`) — persists state across steps
- `useSim()` hook (`src/context/SimContext.tsx`) — global simulation state
- React Router for page navigation

---

## Simulation Flow (Linear)

```
Login → Brief → CM Pitch → Campaign Builder (5-step wizard) → Live Dashboard (30-day sim) → Day 30 Results
```

Pages: `/` → `/brief` → `/cm-pitch` → `/campaign` → `/live` → `/results`

---

## Brand Profiles (`src/data/scenarios.ts`)

7 brands, each with fixed properties that drive ALL downstream decisions:

| Brand | Category | Difficulty | Optimal Objective | Optimal Ad Format | Goal Type |
|-------|----------|------------|-------------------|-------------------|-----------|
| Henlo | Dog Treats | Medium | Performance | product_booster | ROAS-First |
| Glow Republic | Premium Skincare | Hard | Reach | listing_spotlight | Awareness-First |
| VitaBoost | Health Supplements | Very Hard | Reach | listing_spotlight | Category-Creation |
| TinyBuddy | Baby Care | Hard | Reach | brand_booster | Volume-First |
| MunchBox | Packaged Snacks | Medium | Performance | product_booster | ROAS-First |
| PawLife | Pet Accessories | Hard | Reach | recommendation_ads | Awareness-First |
| FuelUp | Protein & Fitness | Very Hard | Performance | product_booster | ROAS-First |

Each brand has:
- `skus[]` — 3 SKUs with mrp, margin, velocity (Very Low / Low / Medium / High)
- `goodKeywords[]` — keywords that convert well
- `riskyKeywords[]` — brand-name / generic keywords that burn budget
- `relevantCategories[]` — drives category targeting options AND Stories feed labels
- `primaryState` + `secondaryStates[]` — only these states have stock (OSA > 0); others = 0 OSA
- `peakHours` — human-readable hint shown in Ad Schedule
- `goalType` — determines which client goals are generated
- `trap` — the key strategic mistake students make with this brand

---

## Campaign Types (Ad Formats)

`adAsset` values in `CampaignForm.tsx`:

### 1. `product_booster` — Product Booster
- **Objective**: Performance
- **Targeting**: Keyword + Category (both enabled)
  - Keywords: multi-select; exact bid + optional smart bid per keyword; min ₹200
  - Category: toggle per `relevantCategory`; CPM bid per category; min ₹200
- **Component sequence**: CampaignCollection → ProductBoosterSettings → ProductBoosterProducts → ProductBoosterTargeting(keyword+category) → ProductBoosterBudget

### 2. `recommendation_ads` — Recommendation Ads
- **Objective**: Reach
- **Targeting**: Keyword ONLY — no category section
  - Pass `showCategoryTargeting={false}` to ProductBoosterTargeting
- **Component sequence**: → RecommendationTargeting / ProductBoosterTargeting(keyword only)

### 3. `listing_spotlight` — Listing Spotlight
- **Objective**: Reach
- **Targeting**: Placement-based — NO keyword targeting, NO category targeting
  - Students select placement: Search Results / Home / Category Pages
  - Can create a Brand Collection (BrandCollectionsView sidebar)
- **Component sequence**: → ListingSpotlightProducts → (no targeting step) → ProductBoosterBudget

### 4. `brand_booster` — Brand Booster
- **Objective**: Reach
- **Targeting**: Category targeting available (same component as Product Booster)
- **Step 3 label changed** to "Brand details" using Stepper `stepLabels` prop → `BrandBoosterBrands`
  - Shows brand from brief with SKU count; brand pre-selected; valid when brand checkbox checked
- **Component sequence**: → BrandBoosterBrands → ProductBoosterTargeting(category only) → ProductBoosterBudget

### 5. `stories` — Stories Ad
- **Objective**: Reach
- **Unique feature**: Ad Schedule in step 1 (ONLY for stories — `showAdSchedule={true}`)
- **Product Details**: `StoriesProducts`
  - Single product: SKU dropdown → Ad Creative (19 BG swatches, brand name ≤14 chars, live preview)
  - Collection of products: existing/create tabs → different Ad Creative (key image upload, brand logo, brand name ≤29 chars)
  - Ad Creative section appears immediately when variant radio is clicked (not after SKU selected)
  - Errors shown only on Next click (`storiesShowErrors` in CampaignForm)
- **Targeting**: `StoriesTargeting`
  - Feed Targeting: Main Feed (₹500) + up to 2 feeds from `relevantCategories` (₹625)
  - CPMs are dynamic (multiplied by day/time selections from Ad Settings)
  - Edit icon on checked feeds to manually override CPM
  - Main Feed expands inline to show "Choose your audience" sub-section
    - Ready-made cohort (multi-select from fixed segments)
    - Custom cohort (User action + Period + Categories from brief + Brand from brief)
  - **Next blocked** unless: ≥1 feed selected AND (if Main Feed selected) audience section complete
- **Component sequence**: → ProductBoosterSettings(showAdSchedule=true) → StoriesProducts → StoriesTargeting → ProductBoosterBudget

---

## Targeting Component Props

### `ProductBoosterTargeting`
```typescript
props: {
  showCategoryTargeting?: boolean  // false for Recommendation Ads, Listing Spotlight
  keywordTargeting?: boolean       // false for Listing Spotlight
  onTargetingValid?: (v: boolean) => void
}
```

Validation formula:
```
isCategoryValid = !showCategoryTargeting || !categoryToggle || all enabled cats have bid ≥ 200
isKeywordBidsValid = all selected keywords have exactBid ≥ 200
hasKeywords = !keywordTargeting || selectedKeywords.length > 0
valid = isCategoryValid && isKeywordBidsValid && hasKeywords
```

---

## Ad Settings — Ad Schedule (`ProductBoosterSettings.tsx`)
Only rendered when `showAdSchedule={true}` (Stories only).

Behavior rules:
- Clicking a day chip → auto-switches radio to "Days of the week"
- Deselecting ALL day chips → auto-switches back to "All days"
- Clicking a time slot → auto-enables Time-slot checkbox
- Deselecting ALL time slots → auto-unchecks Time-slot checkbox

localStorage keys: `sim_schedule_type`, `sim_selected_days`, `sim_timeslot_enabled`, `sim_dayparting`

---

## Stories CPM Dynamic Pricing

Day multipliers (0=Sun…6=Sat): `[1.20, 1.00, 1.00, 1.05, 1.05, 1.15, 1.25]`
Time slot multipliers (idx 0-7): `[0.80, 0.80, 1.00, 1.10, 1.10, 1.20, 1.40, 1.15]`

```
dayMult  = avg(multipliers of selected days)   // or 1.0 if All Days
timeMult = avg(multipliers of selected slots)  // or 1.0 if Time-slot disabled
finalCPM = round(baseCPM × dayMult × timeMult / 25) × 25
```

---

## Budget (`ProductBoosterBudget.tsx`)
- Used by ALL 5 campaign types
- Types: Daily or Overall
- Overall budget requires end date (alert on violation, stay on budget step — do NOT navigate away)
- Total scenario budget: ₹2,00,000 shared across all campaigns

---

## Simulation Engine

### `SavedCampaign` interface
```typescript
{ id, name, objective, adFormat, cities (state names), skuIds, keywords,
  budget, budgetType, geography, launchDay, dayparting, daypartPreset }
```

### `Scenario` structure
- `profile` — BrandProfile (one of 7)
- `season` — affects demand (+/-40% multipliers)
- `market` — Aggressive Competitor = CPMs +35%
- `inventory` — Healthy / Shaky / Critical / Overstocked
- `clientGoals` — driven by brand goalType
- `scheduledCrisis` — brand-specific crisis at a fixed day (see table below)
- `budget` — ₹200,000

### Crisis Schedule
| Brand | Day | Type |
|-------|-----|------|
| Henlo | 12 | stock_crisis |
| Glow Republic | 10 | competitor_attack |
| VitaBoost | 14 | cm_threat |
| TinyBuddy | 9 | cluster_opp |
| MunchBox | 11 | competitor_attack |
| PawLife | 18 | cm_threat |
| FuelUp | 8 | cluster_opp |

---

## Interdependency Rules (Design Principles)

1. **Brief → targeting options**: `relevantCategories` → category bid rows + Stories feed labels + audience categories. `goodKeywords` → keyword suggestions. `primaryState/secondaryStates` → where OSA > 0.

2. **Inventory → budget strategy**: Overstocked = clearance goal (sell-through > ROAS). Critical = pause. Healthy = scale.

3. **Season → CPMs**: Festival +30%. Post-Festival demand -40%.

4. **Market → competition**: Aggressive Competitor CPMs +35%.

5. **Ad format ↔ objective alignment**: Misalignment penalises score. Performance formats (product_booster) suit ROAS brands. Reach formats suit awareness/category-creation brands.

6. **Geography → stock**: Pan India when stock only in 2-3 states = budget wasted on 0-OSA dark stores.

7. **Dayparting → CPM** (Stories): Peak 6PM-9PM = 1.4× CPM. Weekend premium up to 1.25×.

8. **Budget type → pacing**: Daily = safe cap. Overall = can exhaust early if mismanaged.

---

## Key Files Map

| File | Purpose |
|------|---------|
| `src/data/scenarios.ts` | All brand profiles, scenario generation, crisis definitions |
| `src/context/SimContext.tsx` | Global state, campaign CRUD, Supabase sync, token system |
| `src/components/CampaignForm.tsx` | 5-step wizard orchestrator — step routing + validation |
| `src/components/CampaignCollection.tsx` | Step 0 — ad format picker |
| `src/components/ProductBoosterSettings.tsx` | Step 1 — duration, region, ad schedule (stories only) |
| `src/components/ProductBoosterProducts.tsx` | Step 2 — SKU selection (PB + Rec Ads) |
| `src/components/ListingSpotlightProducts.tsx` | Step 2 — Listing Spotlight products + collection creator |
| `src/components/BrandBoosterBrands.tsx` | Step 2 — Brand Booster brand selection |
| `src/components/StoriesProducts.tsx` | Step 2 — Stories product/collection + ad creative preview |
| `src/components/ProductBoosterTargeting.tsx` | Step 3 — keyword + category targeting (shared, prop-driven) |
| `src/components/RecommendationTargeting.tsx` | Step 3 — Recommendation Ads targeting wrapper |
| `src/components/StoriesTargeting.tsx` | Step 3 — feed targeting + audience + dynamic CPM |
| `src/components/ProductBoosterBudget.tsx` | Step 4 — budget (all campaign types) |
| `src/components/Stepper.tsx` | Step progress UI; accepts `stepLabels` prop for brand booster |
| `src/components/BrandCollectionsView.tsx` | Platform sidebar — brand collection management |
| `src/components/CatalogueView.tsx` | Platform sidebar — product catalogue |
| `src/lib/simResults.ts` | 30-day simulation metrics engine |
| `src/lib/scoring.ts` | Final score calculation |
| `src/lib/crisisEvents.ts` | Crisis event definitions and logic |
| `src/lib/weeklyMetrics.ts` | Weekly metric aggregation |
| `src/pages/Brief.tsx` | Brand brief display page |
| `src/pages/Campaign.tsx` | Campaign management page (view/delete/create campaigns) |
| `src/pages/LiveDashboard.tsx` | 30-day live simulation UI |
| `src/pages/Day30Results.tsx` | Final score + results |

---

## localStorage Key Reference (complete)

| Key | Type | Owner |
|-----|------|-------|
| `sim_student` | Student | SimContext |
| `sim_scenario` | Scenario | SimContext |
| `sim_campaigns` | SavedCampaign[] | SimContext |
| `sim_tokens` | number | SimContext |
| `campaign_step` | number | CampaignForm |
| `campaign_name` | string | CampaignForm |
| `campaign_objective` | "performance"\|"reach"\|null | CampaignForm |
| `campaign_adAsset` | AdAsset string | CampaignForm |
| `sim_geography` | "pan_india"\|"select_cities"\|null | ProductBoosterSettings |
| `sim_selected_cities` | string[] (state names) | ProductBoosterSettings |
| `sim_schedule_type` | "all_days"\|"days_of_week" | ProductBoosterSettings |
| `sim_selected_days` | number[] (0=Sun…6=Sat) | ProductBoosterSettings |
| `sim_timeslot_enabled` | boolean | ProductBoosterSettings |
| `sim_dayparting` | number[] (slot indices 0-7) | ProductBoosterSettings |
| `sim_selected_skus` | string[] | ProductBoosterProducts |
| `sim_selected_keywords` | string[] | ProductBoosterTargeting |
| `sim_keyword_exact_bids` | Record<string,string> | ProductBoosterTargeting |
| `sim_keyword_smart_bids` | Record<string,string> | ProductBoosterTargeting |
| `sim_keyword_smart_enabled` | Record<string,boolean> | ProductBoosterTargeting |
| `sim_category_targeting` | boolean | ProductBoosterTargeting |
| `sim_cat_enabled` | Record<string,boolean> | ProductBoosterTargeting |
| `sim_cat_bids` | Record<string,string> | ProductBoosterTargeting |
| `sim_budget_type` | "daily"\|"overall"\|null | ProductBoosterBudget |
| `sim_budget_value` | string | ProductBoosterBudget |
| `sim_campaign_start_date` | string | ProductBoosterBudget |
| `sim_campaign_end_date` | string | ProductBoosterBudget |
| `sim_story_variant` | "single"\|"collection"\|null | StoriesProducts |
| `sim_story_sku` | string\|null | StoriesProducts |
| `sim_story_bg` | string | StoriesProducts |
| `sim_story_brand_name` | string | StoriesProducts |
| `sim_story_coll_tab` | "existing"\|"create" | StoriesProducts |
| `sim_story_existing_colls` | string[] | StoriesProducts |
| `sim_story_coll_name` | string | StoriesProducts |
| `sim_story_coll_brand` | string | StoriesProducts |
| `sim_story_coll_cat` | string | StoriesProducts |
| `sim_story_logo_type` | "upload"\|"none" | StoriesProducts |
| `sim_story_coll_brand_name` | string | StoriesProducts |
| `sim_story_feeds` | string[] | StoriesTargeting |
| `sim_cpm_overrides` | Record<string,string> | StoriesTargeting |
| `sim_audience_open` | boolean | StoriesTargeting |
| `sim_audience_type` | "ready"\|"custom"\|"" | StoriesTargeting |
| `sim_audience_cohorts` | string[] | StoriesTargeting |
| `sim_audience_action` | string | StoriesTargeting |
| `sim_audience_period` | string | StoriesTargeting |
| `sim_audience_cats` | string[] | StoriesTargeting |
| `sim_audience_brands` | string[] | StoriesTargeting |
