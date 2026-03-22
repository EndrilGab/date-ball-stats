
-- Teams table
CREATE TABLE public.teams (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are publicly readable"
ON public.teams FOR SELECT
TO anon, authenticated
USING (true);

-- Matches table
CREATE TABLE public.matches (
  id BIGINT PRIMARY KEY,
  date DATE NOT NULL,
  home_team_id BIGINT REFERENCES public.teams(id) NOT NULL,
  away_team_id BIGINT REFERENCES public.teams(id) NOT NULL,
  home_goals INTEGER NOT NULL DEFAULT 0,
  away_goals INTEGER NOT NULL DEFAULT 0,
  league TEXT,
  season INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are publicly readable"
ON public.matches FOR SELECT
TO anon, authenticated
USING (true);

-- Index for efficient date filtering
CREATE INDEX idx_matches_date_parts ON public.matches (EXTRACT(MONTH FROM date), EXTRACT(DAY FROM date));
CREATE INDEX idx_matches_home_team ON public.matches (home_team_id);
CREATE INDEX idx_matches_away_team ON public.matches (away_team_id);

-- Service role insert policies for edge functions
CREATE POLICY "Service role can insert teams"
ON public.teams FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert matches"
ON public.matches FOR INSERT
TO service_role
WITH CHECK (true);
