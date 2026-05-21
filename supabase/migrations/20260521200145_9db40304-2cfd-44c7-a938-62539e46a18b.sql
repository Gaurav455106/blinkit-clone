
CREATE TABLE public.attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  batch_code TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  scenario JSONB NOT NULL DEFAULT '{}'::jsonb,
  choices JSONB NOT NULL DEFAULT '{}'::jsonb,
  crisis_id TEXT,
  crisis_choice TEXT,
  crisis_points INT NOT NULL DEFAULT 0,
  score_total INT NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read attempts"
  ON public.attempts FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert attempts"
  ON public.attempts FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_attempts_email ON public.attempts(email);
CREATE INDEX idx_attempts_batch ON public.attempts(batch_code);
CREATE INDEX idx_attempts_score ON public.attempts(score_total DESC);
