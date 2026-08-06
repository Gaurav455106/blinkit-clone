-- Replace automatic student-data deletion with admin-controlled deletion.
--
-- Previously, cleanup_idle_students() ran nightly via pg_cron and permanently
-- deleted `attempts` rows (final scores, badges, run snapshots) for any
-- student whose most recent last_seen_at was more than 7 days old. Because
-- `attempts` had no UPDATE policy, the last_seen_at bump on student login
-- (see hydrateFromCloud in SimContext.tsx) was silently rejected by RLS,
-- so in practice every completed attempt was deleted exactly 7 days after
-- creation, unconditionally.
--
-- Deletion of student data should only ever happen as an explicit admin
-- action (individual student or full batch), never automatically.

-- 1. Unschedule and remove the nightly cleanup job.
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup_idle_students_daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.cleanup_idle_students();

-- 2. Add the missing RLS policies on `attempts` so admin-initiated deletes
--    (and the last_seen_at bump on login) actually work instead of being
--    silently rejected. This app has no server-side auth; access to the
--    admin UI is gated client-side (see Login.tsx), consistent with the
--    existing "Anyone can ..." policies on attempts/run_sessions.
DROP POLICY IF EXISTS "Anyone can update attempts" ON public.attempts;
CREATE POLICY "Anyone can update attempts"
  ON public.attempts FOR UPDATE
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete attempts" ON public.attempts;
CREATE POLICY "Anyone can delete attempts"
  ON public.attempts FOR DELETE
  USING (true);
