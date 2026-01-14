const express = require('express');
const path = require('path');
const cron = require('node-cron');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const { accountQueries, hourlyQueries, supabase } = require('./database-supabase');
const { runWorker, queueManager } = require('./worker');
const { importFromCSV, importFromText } = require('./import-accounts');
const { parseBulkAccounts } = require('./platform-detector');
const ReportGenerator = require('./report-generator');
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
    'https://merk-analytics.vercel.app',
    /^https:\/\/.*\.vercel\.app$/ // Allow all Vercel preview deployments
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/reports', express.static('reports')); // Servir les rapports

// ============= ROUTES API EXISTANTES =============

// Récupérer tous les comptes (avec pagination)
app.get('/api/accounts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const platform = req.query.platform;

    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .order('platform')
      .order('username')
      .range(offset, offset + limit - 1);

    if (platform) {
      query = query.eq('platform', platform);
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
    const { platform, username, url } = req.body;

    if (!platform || !username || !url) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    await accountQueries.add.run({ platform, username, url });
    res.json({ success: true, message: 'Compte ajouté avec succès' });
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
    for (const account of results.success) {
      try {
        await accountQueries.add.run({
          platform: account.platform,
          username: account.username,
          url: account.url
        });
        imported++;
      } catch (error) {
        errors.push({
          account,
          error: error.message
        });
      }
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
    // Pour Supabase, on récupère les données et on fait l'agrégation côté JS
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, platform');

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
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .order('platform')
      .order('username');

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
    // Récupérer tous les comptes
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, platform');

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
