-- Merk Analytics - Supabase Database Schema
-- À exécuter dans l'éditeur SQL de Supabase

-- Table: accounts
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  profile_picture TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index sur platform pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Table: videos
CREATE TABLE IF NOT EXISTS videos (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL UNIQUE,
  video_id TEXT,

  -- Metrics (mis à jour à chaque scraping)
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,

  -- Content metadata (collecté une seule fois)
  duration INTEGER,
  published_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  hashtags TEXT,
  audio_name TEXT,
  audio_url TEXT,
  thumbnail_url TEXT,

  -- Tracking
  first_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes par compte
CREATE INDEX IF NOT EXISTS idx_videos_account_id ON videos(account_id);
CREATE INDEX IF NOT EXISTS idx_videos_published_date ON videos(published_date DESC);

-- Table: hourly_stats
CREATE TABLE IF NOT EXISTS hourly_stats (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_videos INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  delta_videos INTEGER DEFAULT 0,
  delta_views BIGINT DEFAULT 0,
  followers BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  platform TEXT,
  username TEXT
);

-- Index pour les requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_hourly_stats_timestamp ON hourly_stats(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_stats_account ON hourly_stats(account_id);

-- Table: apify_keys
CREATE TABLE IF NOT EXISTS apify_keys (
  id BIGSERIAL PRIMARY KEY,
  api_key TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - Optionnel si tu veux gérer les permissions
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_stats ENABLE ROW LEVEL SECURITY;

-- Policies pour permettre l'accès avec la service_role key (backend)
-- Ces policies permettent TOUTES les opérations avec la clé service_role
CREATE POLICY "Enable all access for service role" ON accounts FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON videos FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON hourly_stats FOR ALL USING (true);
ALTER TABLE apify_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role" ON apify_keys FOR ALL USING (true);
