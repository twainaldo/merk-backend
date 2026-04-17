require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const { accountQueries, hourlyQueries, videoQueries, apifyKeyQueries, supabase } = require('./database-supabase');
const { fetchVideosForAccount, fetchStatsForVideos, getNextApiKey } = require('./apify-scraper');
const { runWorker, queueManager } = require('./worker');
const { importFromCSV, importFromText } = require('./import-accounts');
const { parseBulkAccounts } = require('./platform-detector');
const ReportGenerator = require('./report-generator');
const { scrapeProfilePicture } = require('./profile-scraper');
const proxyManager = require('./proxy-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialiser le générateur de rapports
const reportGenerator = new ReportGenerator();

// Configuration multer pour upload CSV
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Fichier doit être un CSV'));
    }
  }
});

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002',
    'https://merkus.uk',
    'https://www.merkus.uk',
    'https://merk-analytics.vercel.app',
    /^https:\/\/.*\.vercel\.app$/ // Allow all Vercel preview deployments
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/reports', express.static('reports')); // Servir les rapports

// ============= ROUTES API EXISTANTES =============

// Récupérer tous les comptes (avec pagination et filtrage par user_id)
app.get('/api/accounts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const platform = req.query.platform;
    const userId = req.query.user_id;

    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .order('platform')
      .order('username')
      .range(offset, offset + limit - 1);

    if (platform) {
      query = query.eq('platform', platform);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: accounts, error, count } = await query;

    if (error) throw error;

    res.json({
      accounts: accounts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un compte
app.post('/api/accounts', async (req, res) => {
  try {
    const { platform, username, url, user_id } = req.body;

    if (!platform || !username || !url) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    const result = await accountQueries.add.run({ platform, username, url, user_id });
    const accountId = result.lastInsertRowid;
    console.log(`✅ Account added: ${username} (${platform}) id=${accountId}`);
    addServerLog(`Account added: @${username} (${platform})`);
    res.json({ success: true, message: 'Compte ajouté avec succès' });

    // Scrape profile picture in background
    scrapeProfilePicture(url, platform).then(async (profilePic) => {
      console.log(`🔍 Profile pic result for ${username}: ${profilePic ? 'found' : 'not found'}`);
      if (profilePic) {
        try {
          const { error } = await supabase
            .from('accounts')
            .update({ profile_picture: profilePic })
            .eq('id', accountId);
          if (error) {
            console.warn(`⚠️ DB error saving profile picture: ${error.message}`);
          } else {
            console.log(`📸 Profile picture saved for ${username}`);
            addServerLog(`Profile picture saved for @${username}`);
          }
        } catch (e) {
          console.warn(`⚠️ Failed to save profile picture: ${e.message}`);
        }
      }
    }).catch(e => console.error(`❌ Profile scrape error for ${username}:`, e.message));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk add (coller plusieurs URLs)
app.post('/api/accounts/bulk', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texte requis' });
    }

    const results = parseBulkAccounts(text);
    let imported = 0;
    const errors = [];

    // Importer chaque compte
    const importedAccounts = [];
    for (const account of results.success) {
      try {
        const result = await accountQueries.add.run({
          platform: account.platform,
          username: account.username,
          url: account.url
        });
        imported++;
        importedAccounts.push({ ...account, id: result.lastInsertRowid });
      } catch (error) {
        errors.push({
          account,
          error: error.message
        });
      }
    }

    // Scrape profile pictures in background
    for (const account of importedAccounts) {
      scrapeProfilePicture(account.url, account.platform).then(async (profilePic) => {
        if (profilePic) {
          try {
            await supabase
              .from('accounts')
              .update({ profile_picture: profilePic })
              .eq('id', account.id);
            console.log(`📸 Profile picture saved for ${account.username}`);
          } catch (e) {
            console.warn(`⚠️ Failed to save profile picture: ${e.message}`);
          }
        }
      }).catch(e => console.error(`❌ Profile scrape error for ${account.username}:`, e.message));
    }

    res.json({
      success: true,
      message: `${imported} compte(s) ajouté(s)`,
      imported,
      skipped: results.errors.length + errors.length,
      parseErrors: results.errors,
      importErrors: errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch profile pictures for a platform (or all)
app.post('/api/accounts/fetch-pictures', async (req, res) => {
  try {
    const { platform } = req.body;
    let query = supabase.from('accounts').select('*');
    if (platform) {
      query = query.ilike('platform', platform);
    }
    const { data: accounts, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    let updated = 0;
    let failed = 0;
    for (const acc of accounts) {
      try {
        const pic = await scrapeProfilePicture(acc.url, acc.platform);
        if (pic) {
          await supabase.from('accounts').update({ profile_picture: pic }).eq('id', acc.id);
          updated++;
          console.log(`📸 Profile picture updated for ${acc.username}`);
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        console.error(`❌ Profile scrape error for ${acc.username}:`, e.message);
      }
    }

    res.json({ success: true, updated, failed, total: accounts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload profile picture manually
const avatarsDir = path.join(__dirname, 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
const avatarUpload = multer({ dest: avatarsDir, limits: { fileSize: 500000 } });

app.post('/api/accounts/:id/upload-avatar', avatarUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fname = `account_${req.params.id}${ext}`;
    const dest = path.join(avatarsDir, fname);
    fs.renameSync(req.file.path, dest);
    const avatarUrl = `/api/avatars/${fname}`;
    await supabase.from('accounts').update({ profile_picture: avatarUrl }).eq('id', req.params.id);
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/avatars/:filename', (req, res) => {
  const safe = path.basename(req.params.filename);
  const p = path.join(avatarsDir, safe);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

// Supprimer un compte
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await accountQueries.delete.run(req.params.id);
    res.json({ success: true, message: 'Compte supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les stats d'un compte
app.get('/api/stats/:accountId', async (req, res) => {
  try {
    const stats = await hourlyQueries.getByAccountAndHours.all(req.params.accountId, 24 * 30); // 30 jours
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard global (simplifié - utilise hourly_stats au lieu de daily_stats)
app.get('/api/dashboard', async (req, res) => {
  try {
    const userId = req.query.user_id;

    let accountsQuery = supabase
      .from('accounts')
      .select('id, platform');

    if (userId) {
      accountsQuery = accountsQuery.eq('user_id', userId);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) throw accountsError;

    const { data: latestStats, error: statsError } = await supabase
      .from('hourly_stats')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000); // Prendre assez de stats pour avoir les dernières par compte

    if (statsError) throw statsError;

    // Grouper par platform
    const summary = {};
    const accountsByPlatform = {};

    accounts.forEach(acc => {
      if (!accountsByPlatform[acc.platform]) {
        accountsByPlatform[acc.platform] = new Set();
        summary[acc.platform] = {
          platform: acc.platform,
          account_count: 0,
          total_videos: 0,
          total_views: 0,
          new_videos_today: 0,
          new_views_today: 0
        };
      }
      accountsByPlatform[acc.platform].add(acc.id);
    });

    // Ajouter les stats
    const latestPerAccount = {};
    (latestStats || []).forEach(stat => {
      if (!latestPerAccount[stat.account_id]) {
        latestPerAccount[stat.account_id] = stat;
      }
    });

    Object.values(latestPerAccount).forEach(stat => {
      const platform = stat.platform;
      if (summary[platform]) {
        summary[platform].total_videos += stat.total_videos || 0;
        summary[platform].total_views += stat.total_views || 0;
        summary[platform].new_videos_today += stat.delta_videos || 0;
        summary[platform].new_views_today += stat.delta_views || 0;
      }
    });

    Object.keys(accountsByPlatform).forEach(platform => {
      summary[platform].account_count = accountsByPlatform[platform].size;
    });

    res.json({
      summary: Object.values(summary),
      recentActivity: latestStats.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= CLIPS POSTING API (for Gavino integration) =============

// Get videos for a specific account, filterable by hashtag
app.get('/api/videos/by-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const videos = await videoQueries.getByUsername.all(username);
    res.json({ videos, count: videos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get videos filtered by hashtag (across all accounts or specific account)
app.get('/api/videos/by-hashtag', async (req, res) => {
  try {
    const { hashtag, account_id } = req.query;
    if (!hashtag) {
      return res.status(400).json({ error: 'hashtag query param required' });
    }
    const videos = await videoQueries.getByHashtag.all(account_id || null, hashtag);
    res.json({ videos, count: videos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get videos grouped by streamer hashtag (for Gavino Posts tab)
app.get('/api/videos/by-streamer', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'username query param required (e.g. martymikey)' });
    }
    const allVideos = await videoQueries.getByUsername.all(username);

    // Group by streamer hashtag
    const streamerMap = {
      'lospollos': ['#lospollos', '#lospollostv'],
      'lacy': ['#lacy', '#fazelacy'],
      'n3on': ['#n3on', '#neon'],
    };

    const grouped = {};
    const unmatched = [];

    allVideos.forEach(v => {
      const ht = (v.hashtags || '').toLowerCase();
      let matched = false;
      for (const [streamer, tags] of Object.entries(streamerMap)) {
        if (tags.some(t => ht.includes(t))) {
          if (!grouped[streamer]) grouped[streamer] = [];
          grouped[streamer].push(v);
          matched = true;
          break;
        }
      }
      if (!matched) unmatched.push(v);
    });

    res.json({
      streamers: Object.entries(grouped).map(([id, videos]) => ({
        id,
        count: videos.length,
        videos: videos.slice(0, 200), // cap per streamer
      })),
      unmatched: { count: unmatched.length, videos: unmatched.slice(0, 50) },
      total: allVideos.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= NOUVELLES ROUTES =============

// Import CSV
app.post('/api/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier CSV requis' });
    }

    const results = await importFromCSV(req.file.path);

    // Supprimer le fichier temporaire
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `${results.imported} comptes importés, ${results.skipped} ignorés`,
      ...results
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Lancer un scraping avec le worker
app.post('/api/scrape', async (req, res) => {
  try {
    // Vérifier si un scraping est déjà en cours
    const stats = queueManager.getCurrentStats();
    if (stats.running > 0 || stats.pending > 0) {
      return res.status(409).json({
        error: 'Un scraping est déjà en cours',
        stats
      });
    }

    res.json({ success: true, message: 'Scraping lancé en arrière-plan' });

    // Lancer le worker en arrière-plan
    runWorker().catch(console.error);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Monitoring de la queue en temps réel
app.get('/api/queue/status', (req, res) => {
  try {
    const stats = queueManager.getCurrentStats();
    const proxyStats = proxyManager.getStats();

    res.json({
      queue: stats,
      proxies: proxyStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Générer un rapport
app.post('/api/reports/generate', async (req, res) => {
  try {
    const date = req.body.date || null;
    const report = await reportGenerator.generateDailyReport(date);

    res.json({
      success: true,
      message: 'Rapport généré avec succès',
      report: {
        filename: report.filename,
        url: `/reports/${report.filename}`,
        date: report.date
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des rapports générés
app.get('/api/reports', (req, res) => {
  try {
    const reports = reportGenerator.listReports();

    res.json({
      reports: reports.map(r => ({
        name: r.name,
        url: `/reports/${r.name}`,
        date: r.date
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Télécharger un rapport
app.get('/api/reports/download/:filename', (req, res) => {
  try {
    const filepath = path.join(__dirname, 'reports', req.params.filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Rapport introuvable' });
    }

    res.download(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Charger les proxies
app.post('/api/proxies/fetch', async (req, res) => {
  try {
    const count = await proxyManager.fetchFreeProxies();
    res.json({
      success: true,
      message: `${count} proxies chargés`,
      stats: proxyManager.getStats()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stats proxies
app.get('/api/proxies/stats', (req, res) => {
  try {
    const stats = proxyManager.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROUTES HOURLY STATS =============

// Récupérer les stats horaires (dernières pour chaque compte)
app.get('/api/hourly-stats', async (req, res) => {
  try {
    const userId = req.query.user_id;

    let accountsQuery = supabase
      .from('accounts')
      .select('*')
      .order('platform')
      .order('username');

    if (userId) {
      accountsQuery = accountsQuery.eq('user_id', userId);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) throw accountsError;

    const latestStats = await hourlyQueries.getLatestPerAccount.all();

    // Fusionner accounts avec leurs stats
    const statsMap = {};
    (latestStats || []).forEach(stat => {
      statsMap[stat.account_id] = stat;
    });

    const result = (accounts || []).map(account => {
      const stat = statsMap[account.id];
      return {
        id: account.id,
        platform: account.platform,
        username: account.username,
        url: account.url,
        total_videos: stat?.total_videos || 0,
        total_views: stat?.total_views || 0,
        delta_videos: stat?.delta_videos || 0,
        delta_views: stat?.delta_views || 0,
        followers: stat?.followers || 0,
        likes: stat?.likes || 0,
        timestamp: stat?.timestamp || null
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer l'historique des stats horaires pour un compte
app.get('/api/hourly-stats/:accountId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await hourlyQueries.getByAccountAndHours.all(req.params.accountId, hours);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les rapports générés par le continuous worker
app.get('/api/continuous-reports', (req, res) => {
  try {
    const reportsDir = path.join(__dirname, 'reports');

    if (!fs.existsSync(reportsDir)) {
      return res.json({ reports: [] });
    }

    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('rapport_'))
      .map(f => {
        const stats = fs.statSync(path.join(reportsDir, f));
        return {
          name: f,
          url: `/reports/${f}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({ reports: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard avec stats horaires
app.get('/api/dashboard/realtime', async (req, res) => {
  try {
    const userId = req.query.user_id;

    let accountsQuery = supabase
      .from('accounts')
      .select('id, platform');

    if (userId) {
      accountsQuery = accountsQuery.eq('user_id', userId);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) throw accountsError;

    // Récupérer les dernières stats pour chaque compte
    const latestStats = await hourlyQueries.getLatestPerAccount.all();

    // Grouper par platform
    const summary = {};
    const accountsByPlatform = {};

    (accounts || []).forEach(acc => {
      if (!accountsByPlatform[acc.platform]) {
        accountsByPlatform[acc.platform] = new Set();
        summary[acc.platform] = {
          platform: acc.platform,
          account_count: 0,
          total_videos: 0,
          total_views: 0,
          delta_videos: 0,
          delta_views: 0
        };
      }
      accountsByPlatform[acc.platform].add(acc.id);
    });

    // Ajouter les stats
    (latestStats || []).forEach(stat => {
      const platform = stat.platform;
      if (summary[platform]) {
        summary[platform].total_videos += stat.total_videos || 0;
        summary[platform].total_views += stat.total_views || 0;
        summary[platform].delta_videos += stat.delta_videos || 0;
        summary[platform].delta_views += stat.delta_views || 0;
      }
    });

    Object.keys(accountsByPlatform).forEach(platform => {
      summary[platform].account_count = accountsByPlatform[platform].size;
    });

    // Derniers rapports générés (groupés par timestamp)
    const { data: allStats, error: statsError } = await supabase
      .from('hourly_stats')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (statsError) throw statsError;

    // Grouper par timestamp
    const timestampCounts = {};
    (allStats || []).forEach(stat => {
      const ts = new Date(stat.timestamp).toISOString();
      timestampCounts[ts] = (timestampCounts[ts] || 0) + 1;
    });

    const lastReports = Object.entries(timestampCounts)
      .map(([timestamp, entries]) => ({ timestamp, entries }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    res.json({
      summary: Object.values(summary),
      lastReports
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SERVER LOGS =============

// In-memory log buffer + SSE clients
const serverLogs = [];
const MAX_LOGS = 500;
const logClients = new Set();

function addServerLog(message, type = 'log') {
  const entry = { time: new Date().toISOString(), message, type };
  serverLogs.push(entry);
  if (serverLogs.length > MAX_LOGS) serverLogs.shift();
  // Broadcast to all SSE clients
  for (const client of logClients) {
    client.write(`data: ${JSON.stringify(entry)}\n\n`);
  }
}

// SSE endpoint: stream all server logs in real-time
app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send existing logs
  for (const log of serverLogs) {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  }

  logClients.add(res);
  req.on('close', () => logClients.delete(res));
});

// ============= APIFY ROUTES =============

// In-memory scraping status
let apifyStatus = { isRunning: false, platform: '', progress: { current: 0, total: 0 }, errors: [] };

// Fetch videos via Apify (SSE stream for live logs)
app.get('/api/apify/fetch-videos', async (req, res) => {
  const platform = req.query.platform;
  if (!platform) return res.status(400).json({ error: 'Platform is required' });

  if (apifyStatus.isRunning) {
    return res.status(409).json({ error: 'A scraping job is already running' });
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendLog = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'log', message: msg })}\n\n`);
    addServerLog(msg);
  };
  const sendDone = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'done', message: msg })}\n\n`);
    addServerLog(msg, 'done');
    res.end();
  };
  const sendError = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    addServerLog(msg, 'error');
    res.end();
  };

  try {
    const keys = await apifyKeyQueries.getAll.all();
    if (keys.length === 0) {
      return sendError('No Apify API keys configured. Add keys in Settings.');
    }

    const platformMap = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', twitter: 'Twitter' };
    const dbPlatform = platformMap[platform.toLowerCase()] || platform;
    const accounts = await accountQueries.getByPlatform.all(dbPlatform);

    if (accounts.length === 0) {
      return sendError(`No accounts found for ${platform}`);
    }

    apifyStatus = { isRunning: true, platform, progress: { current: 0, total: accounts.length }, errors: [] };
    sendLog(`Starting fetch for ${accounts.length} ${platform} account(s)...`);

    let totalVideosFetched = 0;

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      apifyStatus.progress.current = i + 1;
      sendLog(`[${i + 1}/${accounts.length}] @${account.username} — fetching videos...`);

      try {
        const allApiKeys = keys.map(k => k.api_key);
        const videos = await fetchVideosForAccount(allApiKeys, platform.toLowerCase(), account, null, (msg) => sendLog(`[${i + 1}/${accounts.length}] ${msg}`));

        sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ${videos.length} videos fetched, saving...`);
        let saved = 0;
        for (const video of videos) {
          try {
            await videoQueries.upsertFull.run(video);
            saved++;
            if (saved % 100 === 0) {
              sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ${saved}/${videos.length} saved...`);
            }
          } catch (e) {
            if (saved === 0) sendLog(`[${i + 1}/${accounts.length}] ⚠️ Save error: ${e.message}`);
          }
        }
        totalVideosFetched += saved;

        sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ${saved} videos saved (${totalVideosFetched} total)`);

        // Update hourly stats
        const totals = await videoQueries.getTotals.get(account.id);
        const lastStat = await hourlyQueries.getLatest.get(account.id);
        await hourlyQueries.add.run({
          account_id: account.id,
          total_videos: totals.total_videos,
          total_views: totals.total_views,
          delta_videos: totals.total_videos - (lastStat?.total_videos || 0),
          delta_views: totals.total_views - (lastStat?.total_views || 0),
          followers: 0,
          likes: 0,
          platform: dbPlatform,
          username: account.username,
        });
      } catch (e) {
        sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ERROR: ${e.message}`);
        apifyStatus.errors.push(`${account.username}: ${e.message}`);
      }
    }

    apifyStatus.isRunning = false;
    sendDone(`Done! ${totalVideosFetched} videos fetched across ${accounts.length} account(s)`);
  } catch (error) {
    apifyStatus.isRunning = false;
    sendError(error.message);
  }
});

// Fetch ALL platforms sequentially (new posts only — incremental)
app.get('/api/apify/fetch-all', async (req, res) => {
  if (apifyStatus.isRunning) {
    return res.status(409).json({ error: 'A scraping job is already running' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendLog = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'log', message: msg })}\n\n`);
    addServerLog(msg);
  };
  const sendDone = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'done', message: msg })}\n\n`);
    addServerLog(msg);
    res.end();
  };
  const sendError = (msg) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    addServerLog(`ERROR: ${msg}`);
    res.end();
  };

  apifyStatus.isRunning = true;
  let grandTotal = 0;

  try {
    const keys = await apifyKeyQueries.getAll.all();
    if (keys.length === 0) {
      apifyStatus.isRunning = false;
      return sendError('No Apify API keys configured. Add keys in Settings.');
    }
    const allApiKeys = keys.map(k => k.api_key);

    const platforms = [
      { db: 'TikTok', api: 'tiktok' },
      { db: 'Instagram', api: 'instagram' },
      { db: 'YouTube', api: 'youtube' },
    ];

    for (const { db: dbPlatform, api: apiPlatform } of platforms) {
      sendLog(`\n📡 Fetching ${dbPlatform}...`);
      const accounts = await accountQueries.getByPlatform.all(dbPlatform);
      if (!accounts.length) {
        sendLog(`  No ${dbPlatform} accounts, skipping`);
        continue;
      }

      let platformTotal = 0;
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        sendLog(`  [${i+1}/${accounts.length}] @${account.username}...`);
        try {
          const videos = await fetchVideosForAccount(allApiKeys, apiPlatform, account, null, (msg) => sendLog(`  ${msg}`));

          let saved = 0;
          let saveErrors = [];
          for (const video of videos) {
            try {
              await videoQueries.upsertFull.run(video);
              saved++;
            } catch (e) {
              if (saveErrors.length < 3) saveErrors.push(e.message?.substring(0, 80));
            }
          }
          if (saveErrors.length) sendLog(`  ⚠️ Save errors: ${saveErrors.join(' | ')}`);
          sendLog(`  @${account.username}: ${videos.length} videos (${saved} saved)`);
          platformTotal += saved;

          // Update hourly stats
          const totals = await videoQueries.getTotals.get(account.id);
          const lastStat = await hourlyQueries.getLatest.get(account.id);
          await hourlyQueries.add.run({
            account_id: account.id,
            total_videos: totals.total_videos,
            total_views: totals.total_views,
            delta_videos: totals.total_videos - (lastStat?.total_videos || 0),
            delta_views: totals.total_views - (lastStat?.total_views || 0),
            followers: 0, likes: 0,
            platform: dbPlatform, username: account.username,
          });
        } catch (err) {
          sendLog(`  ❌ @${account.username}: ${err.message}`);
        }
      }
      sendLog(`📊 ${dbPlatform}: ${platformTotal} new videos`);
      grandTotal += platformTotal;
    }

    apifyStatus.isRunning = false;
    sendDone(`✅ All done! ${grandTotal} new videos across all platforms`);
  } catch (error) {
    apifyStatus.isRunning = false;
    sendError(error.message);
  }
});

// Fetch stats (update metrics) via Apify (SSE stream)
app.get('/api/apify/fetch-stats', async (req, res) => {
  const platform = req.query.platform;
  if (!platform) return res.status(400).json({ error: 'Platform is required' });

  if (apifyStatus.isRunning) {
    return res.status(409).json({ error: 'A scraping job is already running' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendLog = (msg) => { res.write(`data: ${JSON.stringify({ type: 'log', message: msg })}\n\n`); addServerLog(msg); };
  const sendDone = (msg) => { res.write(`data: ${JSON.stringify({ type: 'done', message: msg })}\n\n`); addServerLog(msg, 'done'); res.end(); };
  const sendError = (msg) => { res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`); addServerLog(msg, 'error'); res.end(); };

  try {
    const keys = await apifyKeyQueries.getAll.all();
    if (keys.length === 0) return sendError('No Apify API keys configured. Add keys in Settings.');

    const platformMap = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', twitter: 'Twitter' };
    const dbPlatform = platformMap[platform.toLowerCase()] || platform;
    const accounts = await accountQueries.getByPlatform.all(dbPlatform);

    if (accounts.length === 0) return sendError(`No accounts found for ${platform}`);

    apifyStatus = { isRunning: true, platform, progress: { current: 0, total: accounts.length }, errors: [] };
    sendLog(`Starting stats update for ${accounts.length} ${platform} account(s)...`);

    let totalUpdated = 0;

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      apifyStatus.progress.current = i + 1;
      sendLog(`[${i + 1}/${accounts.length}] @${account.username} — fetching stats...`);

      try {
        const allApiKeys = keys.map(k => k.api_key);
        const videos = await fetchStatsForVideos(allApiKeys, platform.toLowerCase(), account, null, (msg) => sendLog(`[${i + 1}/${accounts.length}] ${msg}`));

        sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ${videos.length} videos fetched, updating...`);
        let updated = 0;
        for (const video of videos) {
          try {
            await videoQueries.updateMetrics.run(video);
            updated++;
            if (updated % 100 === 0) {
              sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ${updated}/${videos.length} updated...`);
            }
          } catch (e) {}
        }
        totalUpdated += updated;
        sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ${updated} videos updated (${totalUpdated} total)`);
      } catch (e) {
        sendLog(`[${i + 1}/${accounts.length}] @${account.username} — ERROR: ${e.message}`);
        apifyStatus.errors.push(`${account.username}: ${e.message}`);
      }
    }

    apifyStatus.isRunning = false;
    sendDone(`Done! ${totalUpdated} videos updated across ${accounts.length} account(s)`);
  } catch (error) {
    apifyStatus.isRunning = false;
    sendError(error.message);
  }
});

// Get scraping status
app.get('/api/apify/status', (req, res) => {
  res.json(apifyStatus);
});

// ============= SETTINGS ROUTES =============

// List Apify keys (masked)
app.get('/api/settings/apify-keys', async (req, res) => {
  try {
    const keys = await apifyKeyQueries.getAll.all();
    const masked = keys.map(k => ({
      ...k,
      api_key: k.api_key.length > 8
        ? k.api_key.slice(0, 4) + '****' + k.api_key.slice(-4)
        : '****',
    }));
    res.json({ keys: masked, count: keys.length, max: 100 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Apify key
app.post('/api/settings/apify-keys', async (req, res) => {
  try {
    const { api_key, label } = req.body;
    if (!api_key) return res.status(400).json({ error: 'API key is required' });

    const existing = await apifyKeyQueries.getAll.all();
    if (existing.length >= 100) {
      return res.status(400).json({ error: 'Maximum 100 keys allowed' });
    }

    const key = await apifyKeyQueries.add.run({ api_key, label });
    res.json({ success: true, key: { ...key, api_key: key.api_key.slice(0, 4) + '****' + key.api_key.slice(-4) } });
  } catch (error) {
    if (error.message?.includes('unique') || error.code === '23505') {
      return res.status(400).json({ error: 'This API key already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete Apify key
app.delete('/api/settings/apify-keys/:id', async (req, res) => {
  try {
    await apifyKeyQueries.delete.run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= CRON JOBS =============

// Fonction combinée: Scraping + Rapport
const runScrapingWithReport = async (reportName) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🕐 ${reportName} - ${new Date().toLocaleString('fr-FR')}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 1. Charger les proxies
    await proxyManager.fetchFreeProxies();

    // 2. Lancer le scraping
    const results = await runWorker();

    // 3. Générer le rapport
    const report = await reportGenerator.generateDailyReport();

    console.log(`\n✅ ${reportName} terminé avec succès`);
    console.log(`   📊 Rapport: ${report.filename}\n`);
  } catch (error) {
    console.error(`\n❌ Erreur ${reportName}:`, error.message);
  }
};

// RAPPORT MATIN - 9h00
cron.schedule('0 9 * * *', () => {
  runScrapingWithReport('RAPPORT MATIN');
}, {
  timezone: "Europe/Paris"
});

// RAPPORT SOIR - 21h00
cron.schedule('0 21 * * *', () => {
  runScrapingWithReport('RAPPORT SOIR');
}, {
  timezone: "Europe/Paris"
});

// FETCH STATS APIFY - 19h00
cron.schedule('0 19 * * *', async () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🕐 FETCH STATS APIFY 19H - ${new Date().toLocaleString('fr-FR')}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const keys = await apifyKeyQueries.getAll.all();
    if (keys.length === 0) { console.log('❌ No Apify keys configured'); return; }
    const allApiKeys = keys.map(k => k.api_key);

    const accounts = await accountQueries.getByPlatform.all('TikTok');
    if (accounts.length === 0) { console.log('❌ No TikTok accounts'); return; }

    console.log(`📊 Fetching stats for ${accounts.length} TikTok account(s)...`);
    let totalUpdated = 0;

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`[${i + 1}/${accounts.length}] @${account.username} — fetching stats...`);
      try {
        const videos = await fetchStatsForVideos(allApiKeys, 'tiktok', account, null, (msg) => console.log(`  ${msg}`));
        let updated = 0;
        for (const video of videos) {
          try { await videoQueries.updateMetrics.run(video); updated++; } catch (e) {}
        }
        totalUpdated += updated;
        console.log(`[${i + 1}/${accounts.length}] @${account.username} — ${updated} videos updated`);
      } catch (e) {
        console.log(`[${i + 1}/${accounts.length}] @${account.username} — ERROR: ${e.message}`);
      }
    }

    console.log(`\n✅ Fetch stats terminé: ${totalUpdated} videos updated`);
  } catch (error) {
    console.error(`\n❌ Erreur fetch stats:`, error.message);
  }
}, {
  timezone: "Europe/Paris"
});

// Rafraîchir les proxies toutes les heures
cron.schedule('0 * * * *', () => {
  console.log('🔄 Rafraîchissement des proxies...');
  proxyManager.fetchFreeProxies().catch(console.error);
}, {
  timezone: "Europe/Paris"
});

// ============= DÉMARRAGE =============

app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     📊 Social Media Tracker - SCALE MODE                  ║
║                                                            ║
║     🌐 Serveur: http://localhost:${PORT.toString().padEnd(34)} ║
║                                                            ║
║     ⏰ Scraping automatique:                               ║
║        • Matin: 9h00 + Rapport                            ║
║        • Stats: 19h00 (Apify TikTok)                      ║
║        • Soir: 21h00 + Rapport                            ║
║                                                            ║
║     ⚙️ Workers parallèles: ${(process.env.WORKER_CONCURRENCY || 10).toString().padEnd(31)} ║
║     🌐 Proxies rotatifs: Activés                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Charger les proxies au démarrage
  console.log('📡 Chargement initial des proxies...');
  await proxyManager.fetchFreeProxies();
  console.log('✅ Serveur prêt!\n');
});

module.exports = app;
