-- ============================================================================
-- Blinkit Ads Simulation — full schema setup. Run ONCE in the Supabase SQL editor.
--
-- Why this exists: the migrations in supabase/migrations/ were never applied to
-- the live project. `public.attempts` did not exist, so every score insert from
-- Day30Results failed with 42P01 ("relation does not exist") and every read from
-- the Admin / Trainer / Leaderboard views returned nothing.
--
-- Consolidated from:
--   20260521200145  — attempts table + read/insert policies
--   20260522185546  — snapshot/last_seen_at, run_sessions, batch_scores, trigger
--   20260806095647  — update/delete policies on attempts
--
-- Deliberately EXCLUDED: the old cleanup_idle_students() function and its nightly
-- pg_cron job. That job deleted every attempt 7 days after creation. Retention is
-- now admin-controlled only (delete buttons in the Admin panel).
--
-- Safe to re-run: everything is IF NOT EXISTS / DROP-then-CREATE.
-- ============================================================================

-- ── 1. attempts — one row per completed run ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attempts (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  batch_code      TEXT NOT NULL,
  profile_id      TEXT NOT NULL,
  scenario        JSONB NOT NULL DEFAULT '{}'::jsonb,
  choices         JSONB NOT NULL DEFAULT '{}'::jsonb,
  crisis_id       TEXT,
  crisis_choice   TEXT,
  crisis_points   INT NOT NULL DEFAULT 0,
  score_total     INT NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  badge           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added later by 20260522185546 — required by the insert in Day30Results.tsx
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS snapshot      jsonb,
  ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS attempts_email_created_idx ON public.attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_batch_score_idx   ON public.attempts (batch_code, score_total DESC);
CREATE INDEX IF NOT EXISTS attempts_last_seen_idx     ON public.attempts (last_seen_at);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- This app has no server-side auth; admin/trainer access is gated client-side.
DROP POLICY IF EXISTS "Anyone can read attempts"   ON public.attempts;
DROP POLICY IF EXISTS "Anyone can insert attempts" ON public.attempts;
DROP POLICY IF EXISTS "Anyone can update attempts" ON public.attempts;
DROP POLICY IF EXISTS "Anyone can delete attempts" ON public.attempts;

CREATE POLICY "Anyone can read attempts"   ON public.attempts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attempts" ON public.attempts FOR INSERT WITH CHECK (true);
-- UPDATE is needed for the last_seen_at bump in hydrateFromCloud()
CREATE POLICY "Anyone can update attempts" ON public.attempts FOR UPDATE USING (true) WITH CHECK (true);
-- DELETE is needed for the Admin panel's per-student / per-batch delete
CREATE POLICY "Anyone can delete attempts" ON public.attempts FOR DELETE USING (true);

-- ── 2. run_sessions — one live (in-progress) run per student ────────────────
CREATE TABLE IF NOT EXISTS public.run_sessions (
  email        text PRIMARY KEY,
  name         text NOT NULL,
  batch_code   text NOT NULL,
  run_id       text NOT NULL,
  state        jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read run_sessions"   ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can insert run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can update run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can delete run_sessions" ON public.run_sessions;

CREATE POLICY "Anyone can read run_sessions"   ON public.run_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert run_sessions" ON public.run_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update run_sessions" ON public.run_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete run_sessions" ON public.run_sessions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS run_sessions_last_seen_idx ON public.run_sessions (last_seen_at);
CREATE INDEX IF NOT EXISTS run_sessions_batch_idx     ON public.run_sessions (batch_code);

-- ── 3. batch_scores — anonymous aggregate for batch comparisons ─────────────
CREATE TABLE IF NOT EXISTS public.batch_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code      text NOT NULL,
  score_total     integer NOT NULL,
  achievement_pct numeric,
  badge           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batch_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read batch_scores" ON public.batch_scores;
CREATE POLICY "Anyone can read batch_scores" ON public.batch_scores FOR SELECT USING (true);
-- No public INSERT policy: the trigger below is the only writer.

CREATE INDEX IF NOT EXISTS batch_scores_batch_score_idx ON public.batch_scores (batch_code, score_total DESC);

-- ── 4. Mirror each new attempt into batch_scores ────────────────────────────
CREATE OR REPLACE FUNCTION public.copy_attempt_to_batch_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.batch_scores (batch_code, score_total, achievement_pct, badge, created_at)
  VALUES (
    NEW.batch_code,
    NEW.score_total,
    COALESCE((NEW.score_breakdown->>'achievementPct')::numeric, NULL),
    NEW.badge,
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attempt_to_batch_scores ON public.attempts;
CREATE TRIGGER trg_attempt_to_batch_scores
AFTER INSERT ON public.attempts
FOR EACH ROW EXECUTE FUNCTION public.copy_attempt_to_batch_scores();

REVOKE EXECUTE ON FUNCTION public.copy_attempt_to_batch_scores() FROM PUBLIC, anon, authenticated;

-- ── 5. Verify ───────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('attempts', 'run_sessions', 'batch_scores')
ORDER BY table_name;
-- Expect exactly 3 rows: attempts, batch_scores, run_sessions
