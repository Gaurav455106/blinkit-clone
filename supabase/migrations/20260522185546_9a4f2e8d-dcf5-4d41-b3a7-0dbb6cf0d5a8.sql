
-- 1. Extend attempts
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS snapshot jsonb,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS attempts_email_created_idx ON public.attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_batch_score_idx ON public.attempts (batch_code, score_total DESC);
CREATE INDEX IF NOT EXISTS attempts_last_seen_idx ON public.attempts (last_seen_at);

-- 2. run_sessions: one live run per student
CREATE TABLE IF NOT EXISTS public.run_sessions (
  email text PRIMARY KEY,
  name text NOT NULL,
  batch_code text NOT NULL,
  run_id text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can insert run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can update run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can delete run_sessions" ON public.run_sessions;

CREATE POLICY "Anyone can read run_sessions" ON public.run_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert run_sessions" ON public.run_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update run_sessions" ON public.run_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete run_sessions" ON public.run_sessions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS run_sessions_last_seen_idx ON public.run_sessions (last_seen_at);
CREATE INDEX IF NOT EXISTS run_sessions_batch_idx ON public.run_sessions (batch_code);

-- 3. batch_scores: aggregate that survives cleanup
CREATE TABLE IF NOT EXISTS public.batch_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL,
  score_total integer NOT NULL,
  achievement_pct numeric,
  badge text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batch_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read batch_scores" ON public.batch_scores;
CREATE POLICY "Anyone can read batch_scores" ON public.batch_scores FOR SELECT USING (true);
-- No public insert: trigger writes only.

CREATE INDEX IF NOT EXISTS batch_scores_batch_score_idx ON public.batch_scores (batch_code, score_total DESC);

-- 4. Trigger: copy each new attempt into batch_scores
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

-- 5. Backfill batch_scores from existing attempts (idempotent: skip if any rows exist)
INSERT INTO public.batch_scores (batch_code, score_total, achievement_pct, badge, created_at)
SELECT batch_code, score_total,
       COALESCE((score_breakdown->>'achievementPct')::numeric, NULL),
       badge, created_at
FROM public.attempts
WHERE NOT EXISTS (SELECT 1 FROM public.batch_scores);

-- 6. Cleanup function + cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_idle_students()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.run_sessions
   WHERE last_seen_at < now() - interval '7 days';

  DELETE FROM public.attempts a
   WHERE a.email IN (
     SELECT email FROM public.attempts
     GROUP BY email
     HAVING max(last_seen_at) < now() - interval '7 days'
   );
END;
$$;

-- Schedule daily at 02:00 UTC (unschedule existing then reschedule to keep idempotent)
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup_idle_students_daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
  PERFORM cron.schedule('cleanup_idle_students_daily', '0 2 * * *', $cron$SELECT public.cleanup_idle_students();$cron$);
END
$$;
