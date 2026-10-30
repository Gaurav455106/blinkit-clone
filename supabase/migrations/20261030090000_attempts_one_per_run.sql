-- One saved attempt per run, and removal of past double-saves.
--
-- Why: the v1 results page inserted the score again every time it was opened,
-- so some runs were saved 2-3 times with byte-identical data. The app now puts
-- the run id into choices.runId (src/lib/attemptSave.ts); the index below makes
-- a second insert for the same run fail with 23505, which the app treats as
-- "already saved". Older rows have no runId and are not covered by the index.
--
-- Cleanup removes ONLY exact copies: same email, same brief seed, identical
-- score_breakdown, snapshot, score and choices. Retakes of the same brief with
-- different play are kept. Removed rows are copied to backup tables first.
-- Safe to re-run. Runs as one transaction: all of it applies, or none.

BEGIN;

-- ── 1. One attempt per run id ───────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS attempts_one_per_run_idx
  ON public.attempts ((choices->>'runId'))
  WHERE choices ? 'runId';

-- ── 2. Back up and remove exact duplicates (keep the earliest copy) ─────────
CREATE TABLE IF NOT EXISTS public.attempts_duplicate_backup (LIKE public.attempts INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.batch_scores_duplicate_backup (LIKE public.batch_scores INCLUDING DEFAULTS);
-- Backups are for the database owner only: RLS on, no policies
ALTER TABLE public.attempts_duplicate_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_scores_duplicate_backup ENABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS pg_temp.dup_attempts;
CREATE TEMP TABLE dup_attempts AS
SELECT a.*
FROM public.attempts a
WHERE EXISTS (
  SELECT 1 FROM public.attempts e
  WHERE e.email = a.email
    AND e.scenario->>'seed' = a.scenario->>'seed'
    AND e.score_total = a.score_total
    AND e.score_breakdown = a.score_breakdown
    AND e.snapshot IS NOT DISTINCT FROM a.snapshot
    AND e.choices = a.choices
    AND (e.created_at, e.id) < (a.created_at, a.id)
);

INSERT INTO public.attempts_duplicate_backup SELECT * FROM dup_attempts;

-- batch_scores rows are copies made by trigger with the same created_at
WITH gone AS (
  DELETE FROM public.batch_scores b
  USING dup_attempts d
  WHERE b.batch_code = d.batch_code AND b.score_total = d.score_total AND b.created_at = d.created_at
  RETURNING b.*
)
INSERT INTO public.batch_scores_duplicate_backup SELECT * FROM gone;

DELETE FROM public.attempts a USING dup_attempts d WHERE a.id = d.id;

DROP TABLE dup_attempts;

COMMIT;

-- ── 3. Verify ───────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.attempts)                      AS attempts_now,
  (SELECT count(*) FROM public.attempts_duplicate_backup)     AS attempts_backed_up,
  (SELECT count(*) FROM public.batch_scores)                  AS batch_scores_now,
  (SELECT count(*) FROM public.batch_scores_duplicate_backup) AS batch_scores_backed_up;
