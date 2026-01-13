const Database = require('better-sqlite3');
const path = require('path');

// Initialiser la base de données
const db = new Database(path.join(__dirname, 'social-tracker.db'));

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

  CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
  CREATE INDEX IF NOT EXISTS idx_daily_stats_account ON daily_stats(account_id);
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

module.exports = {
  db,
  accountQueries,
  statsQueries
};
