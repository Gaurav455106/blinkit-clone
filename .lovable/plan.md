This is a large build. Here is how I will ship it in one pass, organized so each piece plugs into your existing campaign flow without breaking it.

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud and create two tables:

- `attempts` — stores every campaign attempt
  - id, email, name, batch_code, scenario_seed
  - profile_id, city, season, market, inventory_state (jsonb)
  - choices (jsonb: objective, ad_format, geography, skus, keywords, budget_type)
  - crisis_id, crisis_choice, crisis_points
  - score_total, score_breakdown (jsonb), badge
  - created_at
- `trainers` — single hardcoded check is fine; no table needed. Trainer login is matched in code against `trainer@kraftshala.com / kraft2024`.

Public read for leaderboard, public insert for attempts. No auth — login is just name+email+batch captured into form state and stored on each attempt row.

## 2. Static data module (`src/data/scenarios.ts`)

One file holds:
- 7 brand profiles (SKUs, good/risky keywords, optimal objective, optimal ad format, trap, difficulty, category)
- 4 cities, 5 seasons, 4 inventory states (with OSA/Fill/DarkStores/Aging ranges), 4 market conditions
- 4 crisis scenarios with options + points
- Deterministic seeding helper `pickScenario(email)` using a small string hash so the same email always gets the same scenario; `pickScenario(email + Date.now())` for retry.

## 3. New routes

```
/                  → Login (Screen A)
/brief             → Brand Brief (Screen B)
/campaign          → existing CampaignForm (now reads from scenario context)
/results           → Results + Crisis popup on mount
/leaderboard       → 3 tabs
/trainer           → Trainer dashboard
/trainer/:batch    → Batch detail
```

A new `ScenarioContext` (React context + localStorage) holds the current student + assigned scenario so the existing CampaignForm steps can read from it.

## 4. Hooks into existing CampaignForm

Minimal surgical edits — no rewrites of working steps:
- `ProductBoosterProducts`: replace hardcoded product list with `scenario.profile.skus`.
- `ProductBoosterTargeting` / `RecommendationTargeting`: replace suggested keywords with `scenario.profile.keywords` (good + risky mixed, risky tagged internally for scoring but visually identical aside from a subtle marker).
- On final "Done", instead of just closing, persist all choices into `ScenarioContext` and navigate to `/results`.

## 5. Results flow

On `/results` mount:
1. Show one randomly-chosen crisis modal first (blocking).
2. After user picks an option, compute score using the 8-dimension matrix exactly as specified.
3. Insert attempt row into Supabase.
4. Render results screen: big score, badge, verdict, breakdown bars, "Right / Cost you points" columns, trap callout, CTAs to `/leaderboard` and retry (which goes back to `/brief` with new seed).

## 6. Leaderboard

Single page, three tabs (My Batch / Batch vs Batch / All Students). Pulls from `attempts` table, computes best-per-student and per-batch aggregates client side. Current student row highlighted using the email stored in context.

## 7. Trainer dashboard

`/trainer` lists batch aggregates. `/trainer/:batch` lists individual attempts. CSV export is a client-side blob download from the loaded rows.

## 8. Design

Reuses existing tokens (Blinkit green primary, light card surfaces, numbered stepper). Brief screen styled as an in-platform "client brief" card. Crisis popup is a shadcn Dialog. Results uses the same card system with colored score bars.

## Technical notes

- All new files; only 3 existing files touched: `App.tsx` (routes), `ProductBoosterProducts.tsx`, and the two targeting components (data source swap).
- `CampaignForm.tsx` gets one small change: on Done → navigate to `/results` with choices in context.
- Scoring lives in `src/lib/scoring.ts` — pure function, easy to test.
- Email hash uses a tiny djb2 implementation, no deps.

## What I will NOT do without confirmation

- I will not change the look of your existing 5 campaign steps beyond swapping the data they show.
- I will not add real auth (the spec says simple name/email/batch capture).

Ready to build all of this in one go on approval.