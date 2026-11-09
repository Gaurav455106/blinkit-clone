-- Close the open door on Blinkit's tables.
--
-- Why: the policies below let anyone holding the public (anon) key, which ships
-- inside the website, read, edit or delete every student's attempts and live
-- runs. The website no longer talks to these tables directly: every read and
-- write goes through the /api routes, which check a signed session cookie and
-- use the service-role key on the server (server/store.ts). The service role
-- bypasses RLS, so with these policies gone only the server can reach the data.
--
-- What it changes: policies only. No rows, columns, tables, indexes or triggers
-- are touched, so no data can be lost. RLS stays enabled with no policies, which
-- means "deny everything" to anon and authenticated users.
--
-- ORDER MATTERS: apply only AFTER the /api version of the website is live on
-- Vercel with SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET set. Applied earlier,
-- the old website would stop saving scores.
--
-- Undo (restores the old open access, if ever needed in an emergency):
--   CREATE POLICY "Anyone can read attempts"   ON public.attempts FOR SELECT USING (true);
--   CREATE POLICY "Anyone can insert attempts" ON public.attempts FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Anyone can update attempts" ON public.attempts FOR UPDATE USING (true) WITH CHECK (true);
--   CREATE POLICY "Anyone can delete attempts" ON public.attempts FOR DELETE USING (true);
--   CREATE POLICY "Anyone can read run_sessions"   ON public.run_sessions FOR SELECT USING (true);
--   CREATE POLICY "Anyone can insert run_sessions" ON public.run_sessions FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Anyone can update run_sessions" ON public.run_sessions FOR UPDATE USING (true);
--   CREATE POLICY "Anyone can delete run_sessions" ON public.run_sessions FOR DELETE USING (true);
--   CREATE POLICY "Anyone can read batch_scores" ON public.batch_scores FOR SELECT USING (true);
--
-- Only Blinkit's three tables are touched. Other apps' tables in this project
-- (experts, sessions, alignment_flags, ...) are left alone.
-- Safe to re-run. Runs as one transaction: all of it applies, or none.

BEGIN;

ALTER TABLE public.attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read attempts"   ON public.attempts;
DROP POLICY IF EXISTS "Anyone can insert attempts" ON public.attempts;
DROP POLICY IF EXISTS "Anyone can update attempts" ON public.attempts;
DROP POLICY IF EXISTS "Anyone can delete attempts" ON public.attempts;

DROP POLICY IF EXISTS "Anyone can read run_sessions"   ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can insert run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can update run_sessions" ON public.run_sessions;
DROP POLICY IF EXISTS "Anyone can delete run_sessions" ON public.run_sessions;

DROP POLICY IF EXISTS "Anyone can read batch_scores" ON public.batch_scores;

COMMIT;
