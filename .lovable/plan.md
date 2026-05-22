## Goal

Reshape the post-login flow so students land on a **Brand Central hub** after the Brief, can review **past simulation runs**, scrub through results with a **Day 1 → Day 30 slider**, and face **crises mid-campaign** (one scripted per scenario + a chance of a random one).

## New flow

```
Login → Brief → Brand Central (hub)
                  ├── Past Runs list
                  ├── "Start New Run" → CM Pitch → Campaign wizard → Campaigns Dashboard → Launch
                  └── Click a past/active run → Results View (slider)
```

## 1. Brand Central hub (`/brand-central`)

New page replacing the current direct Brief→CmPitch jump. Layout uses existing Blinkit sidebar + card system.

- Header: "Welcome back, {name}" + brand profile chip from Brief.
- Primary CTA: **Start New Simulation Run** → routes to `/cm-pitch` (resets active campaign state, keeps brief).
- **My Simulation Runs** table: scenario name, launched-on date, status (Draft / Live Day X / Completed), score (if done), action (Resume / View Results / Delete).
- Empty state when no runs yet.
- Runs are loaded from the existing `attempts` table (filtered by email) plus any in-progress run held in `SimContext` / localStorage.

A "run" = one full Brief→Day 30 attempt. Each Launch creates a `run_id`; that id is what gets persisted at Day 30.

## 2. Results with day-range slider

Replace the four separate Day 7/14/21/30 page navigations with a single **Run Results** page (`/run/:runId`) containing:

- A horizontal slider: Day 1 → Day 30 with snap stops at 3, 7, 15, 21, 30 and free scrub in between.
- Live-updating KPI cards (Impressions, Clicks, CTR, Spend, ROAS, Conversions, Stock left) computed by interpolating the existing `weeklyMetrics` curves for the selected day.
- Per-campaign breakdown table for the selected day.
- Strategy Insights panel (existing Phase3StrategyPanel) shown contextually for the current day window.
- Timeline strip below slider marking: launch, scheduled crisis day, any random crisis days, weekly checkpoints, Day 30 final.
- When the slider passes a crisis day that hasn't been resolved yet, the crisis modal blocks further scrubbing until the student picks an option.
- "Lock in Day 30 results" button visible only once slider reaches 30 and all crises are resolved → writes the attempt row and routes to the existing Day 30 results / scoring page.

The existing `/day-7`, `/day-14`, `/day-21` routes become thin redirects to `/run/:runId?day=7|14|21` for back-compat.

## 3. Crises (scheduled + random)

Extend `src/lib/events.ts`:

- **Scheduled crisis**: each brand profile in `src/data/scenarios.ts` gets a `scheduledCrisis: { day, id }` (e.g., Maggi → stockout Day 12, Surf → competitor price-drop Day 9). Deterministic per scenario seed.
- **Random crisis**: 50% chance of one extra crisis on a random day between 5 and 25 (seeded by `email + runId` so it's stable per run).
- Crisis types reuse the existing crisis dataset (stockout, competitor blitz, dark-store outage, rating dip, budget freeze). Each has 2–3 response options with point deltas and metric side-effects.
- New `crises` array on the run record (in `SimContext`): `{ id, day, status: 'pending'|'resolved', choice, pointsDelta }`.
- When resolved, the chosen option mutates the day-onwards metric curve (e.g., stockout choice "airlift stock" restores fill rate from day+2 onward at a budget cost).
- Crisis modal is the existing shadcn Dialog, styled with Blinkit green accent + urgent red header strip.

## 4. SimContext changes

- Add `runs: Run[]` and `activeRunId` in addition to the current single-run state.
- `Run` = `{ id, scenarioSeed, briefSnapshot, campaigns, stock, crises, createdAt, completedAt?, score? }`.
- Persist runs array to localStorage; sync completed runs to `attempts` Supabase table on Day 30 lock-in.
- Helpers: `startNewRun()`, `selectRun(id)`, `resolveCrisis(runId, crisisId, choice)`, `getMetricsForDay(runId, day)`.

## 5. Routing changes (`src/App.tsx`)

- Add `/brand-central` and `/run/:runId`.
- Change post-Brief navigation to `/brand-central`.
- Keep legacy weekly routes as redirects.

## 6. Files

**New**
- `src/pages/BrandCentral.tsx`
- `src/pages/RunResults.tsx`
- `src/components/DayRangeSlider.tsx`
- `src/components/RunTimeline.tsx`
- `src/components/CrisisModal.tsx`

**Edited (surgical)**
- `src/App.tsx` — routes
- `src/context/SimContext.tsx` — multi-run model + crisis state
- `src/lib/events.ts` — scheduled + random crisis generator
- `src/lib/weeklyMetrics.ts` — `getMetricsForDay(day)` interpolator
- `src/data/scenarios.ts` — add `scheduledCrisis` per profile
- `src/pages/Brief.tsx` — navigate to `/brand-central`
- `src/pages/CampaignsDashboard.tsx` — Launch creates a `Run`, routes to `/run/:runId`
- `src/pages/Day30Results.tsx` — read from selected run instead of singleton

## Technical notes

- Day-level metric interpolation: extend existing weekly curves with a smooth cumulative function (linear between checkpoints is fine for v1) so the slider feels live.
- Crisis seeding uses djb2 hash of `email+runId` for reproducibility.
- No DB schema change needed — `attempts.scenario` jsonb already absorbs the extra `runId`, `crises`, `scheduledCrisis` fields.

## Out of scope

- Multi-brand / multi-platform (Phase 4).
- Real-time competitor reactions to crisis choice.
- Editing past completed runs.

# Phase 2.5 — State-based targeting (replaces city-level)

Real Blinkit only offers Pan India or Select States. This phase rewires targeting end-to-end before Phase 3.

## Data model changes

`src/data/scenarios.ts`
- Add `BLINKIT_STATES` (23 states) + `STATE_TO_CITIES` mapping with dark-store counts (per Part 3).
- Replace `CITIES` / `CityName` / `CITY_STORE_COUNT` semantics: keep file exports but switch them to **state names**, with cities surfaced as internal detail via `STATE_TO_CITIES`. Old `CityName` becomes `StateName` alias for back-compat.
- `BrandProfile` gets `primaryState` + `secondaryStates`. Update all 7 profiles per Part 10.
- `cityStockMap` → `stateStockMap: Record<StateName, number>`. Generator assigns OSA to 3–5 plausible states (primary + secondary), 0% elsewhere.
- Scenario keeps a derived stockedStates list for the brief table.

## Brief screen
`src/pages/Brief.tsx`
- Rename "Stock Availability Map" rows to states. Show only states with OSA > 0 (4–6 rows). Columns: State · Cities Stocked (e.g. "Bangalore (32/40)") · OSA % · Status.
- Update warning note: "Blinkit shows all 23 states as selectable… match state to stock reality."

## Campaign builder (Step 2 — Ad Settings)
`src/components/ProductBoosterSettings.tsx`
- Radios: "Pan India" / "Select States".
- When "Select States" → multi-select dropdown of all 23 states (no greying, no warnings, no OSA hints).
- Persist under `sim_selected_states` (replacing `sim_selected_cities`).
- Remove pin-code / zone / city UI entirely.
- Add new **Dayparting** section below state selection (8 time blocks, presets, product-aware hint). Persist under `sim_dayparting` (array of block indices) + `sim_daypart_preset`.

`src/components/CampaignForm.tsx`
- Save `states` instead of `cities`; save `dayparting` block array.

`src/context/SimContext.tsx`
- `SavedCampaign.cities` → `states: string[]`; add `dayparting: number[]` (block indices 0–7) and `daypartPreset`.
- `CmPitchSku.cities` → `states: StateName[]`; `CmPitchResult.approvedCities` → `approvedStates`.

## CM pitch
`src/pages/CmPitch.tsx`
- "Target cities" → "Target states", multi-select all 23 (no greying).
- Evaluation: reject if any pitched state has 0% stock; reject if pitched to all 23; strong if all pitched states have stock and ≤2 SKUs.

## Live simulation
`src/lib/weeklyMetrics.ts`
- Compute per-state spend share. For each campaign:
  - Determine target states: explicit list, or all 23 when Pan India.
  - For each state, lookup OSA from `stateStockMap`.
    - OSA = 0 → 0 spend, 0 revenue (budget unspent).
    - OSA < 30 → 0.3× spend rate, ROAS heavily penalized.
    - OSA ≥ 30 → normal.
  - Apply dayparting multiplier: bonus if active blocks match product peak, 0.4× if only dead-hour blocks active.
- Surface per-state metrics on the result for drilldown.

`src/pages/LiveDashboard.tsx`
- Header "City Performance" panel → "State Performance" with cities-in-state column.
- Insights reference states.
- New always-on insight: if any selected state has 0% stock → "🚨 Budget Not Spending in [State]".

## Scoring
`src/lib/scoring.ts` (+ `src/lib/simResults.ts` for Results screen)
- Add State Selection Quality (10 pts) and Dayparting (5 pts) per Parts 5 & 8.
- Results screen surfaces "❌ Pan India Trap" callout when Pan India selected with stock in ≤3 states.

## UI language sweep
- `cities` → `states` in all visible labels (CampaignsDashboard table, dashboards, results).

## Files touched (~12)
- src/data/scenarios.ts
- src/context/SimContext.tsx
- src/pages/Brief.tsx
- src/pages/CmPitch.tsx
- src/components/ProductBoosterSettings.tsx
- src/components/CampaignForm.tsx
- src/components/ProductBoosterTargeting.tsx (remove zone/pincode UI if any)
- src/components/RecommendationTargeting.tsx (same cleanup)
- src/lib/weeklyMetrics.ts
- src/lib/scoring.ts + src/lib/simResults.ts
- src/pages/LiveDashboard.tsx
- src/pages/CampaignsDashboard.tsx / Day30Results.tsx (labels + Pan India trap)

## Notes
- Backward-compat aliases (`cities` → `states`) added in context to avoid breaking unread call sites; old localStorage keys cleared on new run.
- Pin-code / zone files (`src/data/zones.ts`, ProductBoosterTargeting zone UI) get gutted but kept as no-ops to avoid wider refactor.
