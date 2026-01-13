-- Merk Analytics Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for platform types
CREATE TYPE platform_type AS ENUM ('youtube', 'tiktok', 'instagram', 'facebook');

-- Create enum for account status
CREATE TYPE account_status AS ENUM ('active', 'inactive', 'error');

-- Tracked Accounts Table
CREATE TABLE tracked_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_account_id TEXT NOT NULL, -- ID du compte sur la plateforme (channel_id, username, etc.)
  platform_username TEXT NOT NULL, -- Nom d'utilisateur
  platform_display_name TEXT, -- Nom d'affichage
  avatar_url TEXT,
  status account_status DEFAULT 'active',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, platform, platform_account_id)
);

-- Videos Table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES tracked_accounts(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_video_id TEXT NOT NULL, -- ID de la vidéo sur la plateforme
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- Durée en secondes
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(platform, platform_video_id)
);

-- Video Analytics Table (historique des stats)
CREATE TABLE video_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  engagement_rate DECIMAL(5,2), -- Pourcentage
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collections Table (pour grouper les comptes)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Collection Accounts (many-to-many relationship)
CREATE TABLE collection_accounts (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES tracked_accounts(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  PRIMARY KEY (collection_id, account_id)
);

-- Create indexes for better performance
CREATE INDEX idx_tracked_accounts_user_id ON tracked_accounts(user_id);
CREATE INDEX idx_tracked_accounts_platform ON tracked_accounts(platform);
CREATE INDEX idx_videos_account_id ON videos(account_id);
CREATE INDEX idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX idx_video_analytics_video_id ON video_analytics(video_id);
CREATE INDEX idx_video_analytics_recorded_at ON video_analytics(recorded_at DESC);
CREATE INDEX idx_collections_user_id ON collections(user_id);

-- Unique index to ensure one analytics entry per video per day
CREATE UNIQUE INDEX idx_unique_video_analytics_per_day
  ON video_analytics(video_id, DATE(recorded_at));

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE tracked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_accounts ENABLE ROW LEVEL SECURITY;

-- Tracked Accounts Policies
CREATE POLICY "Users can view their own tracked accounts"
  ON tracked_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked accounts"
  ON tracked_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked accounts"
  ON tracked_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked accounts"
  ON tracked_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Videos Policies
CREATE POLICY "Users can view videos from their tracked accounts"
  ON videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tracked_accounts
      WHERE tracked_accounts.id = videos.account_id
      AND tracked_accounts.user_id = auth.uid()
    )
  );

-- Video Analytics Policies
CREATE POLICY "Users can view analytics from their tracked videos"
  ON video_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      JOIN tracked_accounts ON tracked_accounts.id = videos.account_id
      WHERE videos.id = video_analytics.video_id
      AND tracked_accounts.user_id = auth.uid()
    )
  );

-- Collections Policies
CREATE POLICY "Users can view their own collections"
  ON collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);

-- Collection Accounts Policies
CREATE POLICY "Users can manage their collection accounts"
  ON collection_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_accounts.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamps
CREATE TRIGGER update_tracked_accounts_updated_at BEFORE UPDATE ON tracked_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a default "All Accounts" collection for each new user
CREATE OR REPLACE FUNCTION create_default_collection()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO collections (user_id, name, description)
    VALUES (NEW.id, 'Default', 'All tracked accounts');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_user_default_collection AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_collection();
