
-- ============================================
-- ADMIN ROLE SYSTEM
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- TIMESTAMP TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- SEASONS
-- ============================================

CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  rules_config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasons are publicly readable"
  ON public.seasons FOR SELECT USING (true);

CREATE POLICY "Admins can manage seasons"
  ON public.seasons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROUNDS (JORNADES)
-- ============================================

CREATE TYPE public.round_status AS ENUM ('draft', 'imported', 'review', 'validated', 'published');

CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  club TEXT,
  course TEXT,
  sponsor TEXT,
  sponsor_logo_url TEXT,
  is_master BOOLEAN NOT NULL DEFAULT false,
  master_coefficient NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  status round_status NOT NULL DEFAULT 'draft',
  external_links JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, round_number)
);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published rounds are publicly readable"
  ON public.rounds FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can read all rounds"
  ON public.rounds FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage rounds"
  ON public.rounds FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON public.rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PLAYERS (JUGADORS)
-- ============================================

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  photo_url TEXT,
  club TEXT,
  initial_handicap NUMERIC(4,1),
  current_handicap NUMERIC(4,1),
  gender TEXT CHECK (gender IN ('M', 'F')),
  is_senior BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are publicly readable"
  ON public.players FOR SELECT USING (true);

CREATE POLICY "Admins can manage players"
  ON public.players FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_players_license ON public.players(license);
CREATE INDEX idx_players_name ON public.players(name);

-- ============================================
-- RESULTS
-- ============================================

CREATE TYPE public.player_category AS ENUM ('hcp_low', 'hcp_high');

CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  handicap_at_round NUMERIC(4,1),
  stableford_points INTEGER,
  scratch_score INTEGER,
  category player_category,
  is_female_prize BOOLEAN NOT NULL DEFAULT false,
  is_senior_prize BOOLEAN NOT NULL DEFAULT false,
  scorecard JSONB,
  play_date DATE,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id, play_date)
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results are publicly readable"
  ON public.results FOR SELECT USING (true);

CREATE POLICY "Admins can manage results"
  ON public.results FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_results_updated_at
  BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_results_round ON public.results(round_id);
CREATE INDEX idx_results_player ON public.results(player_id);
CREATE INDEX idx_results_category ON public.results(category);

-- ============================================
-- IMPORT LOGS
-- ============================================

CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  records_imported INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  warnings JSONB DEFAULT '[]',
  skipped_records JSONB DEFAULT '[]',
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read import logs"
  ON public.import_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage import logs"
  ON public.import_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- NEWS DRAFTS
-- ============================================

CREATE TABLE public.news_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ca', 'es')),
  tone TEXT NOT NULL CHECK (tone IN ('journalistic', 'friendly')),
  title TEXT,
  subtitle TEXT,
  body TEXT,
  highlights JSONB DEFAULT '[]',
  seo_excerpt TEXT,
  special_mention TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published news are publicly readable"
  ON public.news_drafts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can read all news"
  ON public.news_drafts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage news"
  ON public.news_drafts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_news_drafts_updated_at
  BEFORE UPDATE ON public.news_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PHOTOS
-- ============================================

CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('winners', 'gallery')),
  url TEXT NOT NULL,
  caption TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos are publicly readable"
  ON public.photos FOR SELECT USING (true);

CREATE POLICY "Admins can manage photos"
  ON public.photos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STORAGE BUCKET FOR PHOTOS
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

CREATE POLICY "Photos are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "Admins can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'photos' AND public.has_role(auth.uid(), 'admin'));
