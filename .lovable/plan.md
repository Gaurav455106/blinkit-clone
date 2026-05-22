# Cloud-synced runs + batch leaderboard

Make every student's progress survive across devices via Lovable Cloud, keep batch scores forever, and drop personal student rows after 7 days of inactivity. Stays inside the free tier at 100+ concurrent students.

## 1. Database migration (one call)

**Alter `attempts`:**
- Add `snapshot jsonb` (nullable) — full run state for review rehydration.
- Add `last_seen_at timestamptz not null default now()` — bumped on login and review.
- Indexes: `(email, created_at desc)`, `(batch_code, score_total desc)`, `(last_seen_at)`.

**New `run_sessions` (one live run per student, public RLS select/insert/update/delete=true):**
- `email text primary key`, `name text`, `batch_code text`, `run_id text`, `state jsonb`, `started_at timestamptz default now()`, `last_seen_at timestamptz default now()`.

**New `batch_scores` (aggregate that survives cleanup, public select=true, no public insert):**
- `id uuid pk`, `batch_code text not null`, `score_total int not null`, `achievement_pct numeric`, `badge text`, `created_at timestamptz default now()`.
- Index `(batch_code, score_total desc)`.

**Trigger:** `after insert on attempts` → copy `(batch_code, score_total, achievement_pct, badge)` into `batch_scores`.

**Cleanup (pg_cron, daily 02:00 UTC, free):**
- `delete from run_sessions where last_seen_at < now() - interval '7 days'`.
- `delete from attempts where email in (select email from attempts group by email having max(last_seen_at) < now() - interval '7 days')`.
- `batch_scores` untouched.

## 2. SimContext — cloud sync

- `setStudent(name, email, batch)`: upsert `run_sessions.last_seen_at`, fetch `attempts where email=? order by created_at desc` → hydrate `runHistory`, fetch `run_sessions where email=?` → restore live run + `activeRunId` if present.
- While `activeRunId` is set, debounce 1.5s and upsert `run_sessions {email, name, batch_code, run_id, state: <serialized run state>}`.
- `completeRun`: insert into `attempts` with `snapshot`, then `delete from run_sessions where email=?`. Trigger writes `batch_scores`.
- `localStorage` becomes a fast-path cache only; backend overwrites on login.
- Snapshot guardrail: strip `decisionsLog` / `microDecisionsLog` if serialized size > 400 KB.

## 3. Leaderboard — two tabs

- **Students** tab (default for student's own batch, "All batches" toggle): from `attempts`, scoped to last 7 days by design (cleanup enforces it). Batch dropdown + free-text search.
- **Batches** tab: from `batch_scores`, grouped by `batch_code` showing avg score, top score, attempts count. Search + sort. Survives cleanup forever.

## 4. Dashboard

- `runHistory` comes from `attempts` (backend).
- "Active Run" card driven by `run_sessions` row.
- Small "Synced ✓ / Saving…" indicator next to student name.

## Technical details

- No edge functions, no Lovable AI calls, no third-party APIs.
- All tables use permissive public RLS (no auth in this app); writes go through anon client.
- pg_cron extension enabled in migration.
- At 100 students × ~6 rows each ≈ 600 rows + ~90 MB jsonb — well under 500 MB free DB cap.

## Files touched

- `supabase/migrations/<new>.sql`
- `src/context/SimContext.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Leaderboard.tsx` (new Batches tab + filters)

## Out of scope

Real auth, trainer cross-batch analytics, scoring/crisis logic changes, the 7-tab flow gating done in the previous turn.
