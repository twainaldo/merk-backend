const express = require('express');
const path = require('path');
const cron = require('node-cron');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const { accountQueries, statsQueries, db } = require('./database');
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
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/reports', express.static('reports')); // Servir les rapports

// ============= ROUTES API EXISTANTES =============

// Récupérer tous les comptes (avec pagination)
app.get('/api/accounts', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const platform = req.query.platform;

    let query = 'SELECT * FROM accounts';
    let countQuery = 'SELECT COUNT(*) as total FROM accounts';
    const params = [];

    if (platform) {
      query += ' WHERE platform = ?';
      countQuery += ' WHERE platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY platform, username LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const accounts = db.prepare(query).all(...params);

    // Pour le count, on a besoin seulement du paramètre platform si il existe
    const countParams = platform ? [platform] : [];
    const total = db.prepare(countQuery).get(...countParams);

    res.json({
      accounts,
      pagination: {
        page,
        limit,
        total: total.total,
        pages: Math.ceil(total.total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un compte
app.post('/api/accounts', (req, res) => {
  try {
    const { platform, username, url } = req.body;

    if (!platform || !username || !url) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    accountQueries.add.run({ platform, username, url });
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
    results.success.forEach(account => {
      try {
        accountQueries.add.run({
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
    });

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
app.delete('/api/accounts/:id', (req, res) => {
  try {
    accountQueries.delete.run(req.params.id);
    res.json({ success: true, message: 'Compte supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les stats d'un compte
app.get('/api/stats/:accountId', (req, res) => {
  try {
    const stats = statsQueries.getByAccount.all(req.params.accountId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard global
app.get('/api/dashboard', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT
        a.platform,
        COUNT(DISTINCT a.id) as account_count,
        COALESCE(SUM(d.total_videos), 0) as total_videos,
        COALESCE(SUM(d.total_views), 0) as total_views,
        COALESCE(SUM(d.new_videos), 0) as new_videos_today,
        COALESCE(SUM(d.new_views), 0) as new_views_today
      FROM accounts a
      LEFT JOIN daily_stats d ON a.id = d.account_id AND d.date = date('now')
      GROUP BY a.platform
    `).all();

    const recentActivity = db.prepare(`
      SELECT
        a.platform,
        a.username,
        d.date,
        d.total_videos,
        d.total_views,
        d.new_videos,
        d.new_views
      FROM daily_stats d
      JOIN accounts a ON d.account_id = a.id
      ORDER BY d.scraped_at DESC
      LIMIT 10
    `).all();

    res.json({
      summary,
      recentActivity
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

// Récupérer les stats horaires (dernières 24h)
app.get('/api/hourly-stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        a.id,
        a.platform,
        a.username,
        a.url,
        h.total_videos,
        h.total_views,
        h.delta_videos,
        h.delta_views,
        h.followers,
        h.likes,
        h.timestamp
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, MAX(timestamp) as max_timestamp
        FROM hourly_stats
        GROUP BY account_id
      ) latest ON a.id = latest.account_id
      LEFT JOIN hourly_stats h ON h.account_id = latest.account_id AND h.timestamp = latest.max_timestamp
      ORDER BY a.platform, a.username
    `).all();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer l'historique des stats horaires pour un compte
app.get('/api/hourly-stats/:accountId', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;

    const stats = db.prepare(`
      SELECT * FROM hourly_stats
      WHERE account_id = ?
      AND timestamp >= datetime('now', '-${hours} hours')
      ORDER BY timestamp DESC
    `).all(req.params.accountId);

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
app.get('/api/dashboard/realtime', (req, res) => {
  try {
    // Stats globales les plus récentes
    const summary = db.prepare(`
      SELECT
        a.platform,
        COUNT(DISTINCT a.id) as account_count,
        COALESCE(SUM(h.total_videos), 0) as total_videos,
        COALESCE(SUM(h.total_views), 0) as total_views,
        COALESCE(SUM(h.delta_videos), 0) as delta_videos,
        COALESCE(SUM(h.delta_views), 0) as delta_views
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, total_videos, total_views, delta_videos, delta_views
        FROM hourly_stats h1
        WHERE timestamp = (
          SELECT MAX(timestamp)
          FROM hourly_stats h2
          WHERE h2.account_id = h1.account_id
        )
      ) h ON a.id = h.account_id
      GROUP BY a.platform
    `).all();

    // Derniers rapports générés
    const lastReports = db.prepare(`
      SELECT timestamp, COUNT(*) as entries
      FROM hourly_stats
      GROUP BY timestamp
      ORDER BY timestamp DESC
      LIMIT 10
    `).all();

    res.json({
      summary,
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
