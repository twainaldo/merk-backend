const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Utiliser un dossier persistant sur Railway si disponible
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dbPath = path.join(dataDir, 'social-tracker.db');

// Créer le dossier si nécessaire
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialiser la base de données
const db = new Database(dbPath);
console.log(`📊 Database initialized at: ${dbPath}`);

// Créer les tables
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, username)
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_videos INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    new_videos INTEGER DEFAULT 0,
    new_views INTEGER DEFAULT 0,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    UNIQUE(account_id, date)
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    video_url TEXT NOT NULL,
    video_id TEXT,

    -- Metrics (updated on every scrape)
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,

    -- Content metadata (collected once on first scrape)
    duration INTEGER,
    published_date DATETIME,
    description TEXT,
    hashtags TEXT,
    audio_name TEXT,
    audio_url TEXT,
    thumbnail_url TEXT,

    -- Tracking
    first_scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (account_id) REFERENCES accounts(id),
    UNIQUE(video_url)
  );

  CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
  CREATE INDEX IF NOT EXISTS idx_daily_stats_account ON daily_stats(account_id);
  CREATE INDEX IF NOT EXISTS idx_videos_account ON videos(account_id);
  CREATE INDEX IF NOT EXISTS idx_videos_url ON videos(video_url);
  CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_date);
`);

// Fonctions pour gérer les comptes
const accountQueries = {
  add: db.prepare(`
    INSERT INTO accounts (platform, username, url)
    VALUES (@platform, @username, @url)
    ON CONFLICT(platform, username) DO UPDATE SET url = @url
  `),

  getAll: db.prepare('SELECT * FROM accounts ORDER BY platform, username'),

  getByPlatform: db.prepare('SELECT * FROM accounts WHERE platform = ?'),

  delete: db.prepare('DELETE FROM accounts WHERE id = ?')
};

// Fonctions pour gérer les stats
const statsQueries = {
  add: db.prepare(`
    INSERT INTO daily_stats (account_id, date, total_videos, total_views, new_videos, new_views)
    VALUES (@account_id, @date, @total_videos, @total_views, @new_videos, @new_views)
    ON CONFLICT(account_id, date) DO UPDATE SET
      total_videos = @total_videos,
      total_views = @total_views,
      new_videos = @new_videos,
      new_views = @new_views,
      scraped_at = CURRENT_TIMESTAMP
  `),

  getLatest: db.prepare(`
    SELECT * FROM daily_stats
    WHERE account_id = ?
    ORDER BY date DESC
    LIMIT 1
  `),

  getByAccount: db.prepare(`
    SELECT * FROM daily_stats
    WHERE account_id = ?
    ORDER BY date DESC
    LIMIT 30
  `),

  getAllToday: db.prepare(`
    SELECT a.platform, a.username, a.url, d.*
    FROM accounts a
    LEFT JOIN daily_stats d ON a.id = d.account_id AND d.date = date('now')
    ORDER BY a.platform, a.username
  `)
};

// Fonctions pour gérer les vidéos
const videoQueries = {
  // Insérer ou mettre à jour une vidéo (full data pour nouvelle vidéo)
  upsertFull: db.prepare(`
    INSERT INTO videos (
      account_id, video_url, video_id,
      views, likes, comments, shares, saves,
      duration, published_date, description, hashtags,
      audio_name, audio_url, thumbnail_url
    ) VALUES (
      @account_id, @video_url, @video_id,
      @views, @likes, @comments, @shares, @saves,
      @duration, @published_date, @description, @hashtags,
      @audio_name, @audio_url, @thumbnail_url
    )
    ON CONFLICT(video_url) DO UPDATE SET
      views = @views,
      likes = @likes,
      comments = @comments,
      shares = @shares,
      saves = @saves,
      last_scraped_at = CURRENT_TIMESTAMP
  `),

  // Mettre à jour seulement les metrics pour une vidéo existante
  updateMetrics: db.prepare(`
    UPDATE videos SET
      views = @views,
      likes = @likes,
      comments = @comments,
      shares = @shares,
      saves = @saves,
      last_scraped_at = CURRENT_TIMESTAMP
    WHERE video_url = @video_url
  `),

  // Vérifier si une vidéo existe
  exists: db.prepare(`
    SELECT id FROM videos WHERE video_url = ?
  `),

  // Récupérer toutes les vidéos d'un compte
  getByAccount: db.prepare(`
    SELECT * FROM videos
    WHERE account_id = ?
    ORDER BY published_date DESC
  `),

  // Récupérer les vidéos les plus performantes
  getTopVideos: db.prepare(`
    SELECT v.*, a.platform, a.username
    FROM videos v
    JOIN accounts a ON v.account_id = a.id
    ORDER BY v.views DESC
    LIMIT ?
  `),

  // Récupérer les URLs des vidéos d'un compte (pour vérifier si nouvelle)
  getUrlsByAccount: db.prepare(`
    SELECT video_url FROM videos WHERE account_id = ?
  `)
};

module.exports = {
  db,
  accountQueries,
  statsQueries,
  videoQueries
};
