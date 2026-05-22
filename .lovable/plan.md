## Problem

The left sidebar always shows all 7 tabs (Dashboard, Brief, CM Pitch, Campaigns, Simulation, Results, Leaderboard) regardless of context. On `/dashboard`, those flow tabs are meaningless — there's no active run yet — and a student can click into half-finished screens with empty state. Same after "Start New Scenario" the user expects a guided flow, not free jumping.

## Proposed behavior

Sidebar items become **context-aware**, driven by what the student is actually doing:

### Mode A — Home (no active run, not reviewing)
Route: `/dashboard` (and `/leaderboard`)
Sidebar shows only:
- Dashboard
- Leaderboard
- Sign out

The flow tabs (Brief / CM Pitch / Campaigns / Simulation / Results) are **hidden**, because they have no run to operate on.

### Mode B — Active run (student clicked "Start New Scenario" and is mid-flow)
Triggered by: `activeRunId` is set in SimContext.
Sidebar shows full flow:
- Dashboard
- Brief
- CM Pitch
- Campaigns
- Simulation
- Results (enabled only after Day 30)
- Leaderboard
- Sign out

Tabs ahead of the student's current step stay clickable (current behavior) but tabs are scoped to the live run only.

### Mode C — Reviewing a past attempt
Triggered by clicking a row in "Past Attempts" on `/dashboard`.
- Loads that saved run's snapshot (scenario, campaigns, cmPitch, weekTotals, decisionsLog, crisisResponses, score) from `runHistory` / Supabase `attempts` into a new **review** state in SimContext (`reviewRunId`).
- Routes to `/results` for that run.
- Sidebar shows the full flow (same as Mode B) but in **read-only** mode — a small "Reviewing past run · Brand X" banner appears in `FlowHeader`, and a "Exit review" button returns to `/dashboard` and clears `reviewRunId`.
- No edits possible; no new Supabase insert.

## Implementation outline

1. **SimContext**
   - Add `reviewRunId: string | null` and `enterReview(runId)` / `exitReview()`.
   - When entering review, hydrate scenario/campaigns/etc. from the stored `RunHistoryEntry` snapshot (extend the entry shape to keep a `snapshot` blob written at `completeRun` time).
   - Expose a derived `mode: "home" | "run" | "review"`.

2. **BlinkitSidebar**
   - Filter `navItems` by `mode`:
     - `home` → `[Dashboard, Leaderboard]`
     - `run` / `review` → all 7 items
   - In review mode, optionally dim Results-only-after-Day-30 logic is irrelevant (already complete).

3. **Dashboard "Past Attempts" table**
   - Make each row a button → `enterReview(run.id)` then `nav("/results")`.
   - Add a hover state and "View" affordance.

4. **FlowHeader**
   - When `mode === "review"`, render a slim banner: "Reviewing **{brandName}** — {date} · Score {score}/100" with an "Exit review" button.

5. **Route guards (App.tsx)**
   - `/brief`, `/cm-pitch`, `/campaign`, `/simulation`, `/results`: require `mode === "run"` or `"review"`. Otherwise redirect to `/dashboard`.
   - This prevents typing `/brief` in the URL bar from working when no run is active.

6. **completeRun**
   - Persist a `snapshot` on the `RunHistoryEntry` (campaigns, cmPitch, weekTotals, decisionsLog, crisisResponses, scenario seed) so review can rehydrate without re-running math.

## Out of scope
- No changes to scoring, crisis logic, or Supabase schema.
- Trainer Console / `/trainer` guard stays as is.

## Questions before implementing
None blocking — I'll proceed with the three modes above. If you'd rather keep Leaderboard hidden from the Home sidebar too (and only reachable via the Dashboard CTA), say so and I'll trim it.