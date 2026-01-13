const { accountQueries, db } = require('./database');
const { scrapeAccount } = require('./scrapers');
const proxyManager = require('./proxy-manager');
const PQueue = require('p-queue').default;
const ExcelJS = require('exceljs');
const fs = require('fs');

// Configuration
const SCRAPE_INTERVAL = 60 * 60 * 1000; // 1 heure en millisecondes
const WORKERS = 10; // Nombre de workers parallèles

// Créer la table hourly_stats si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS hourly_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_videos INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    delta_videos INTEGER DEFAULT 0,
    delta_views INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_hourly_stats_timestamp ON hourly_stats(timestamp);
  CREATE INDEX IF NOT EXISTS idx_hourly_stats_account ON hourly_stats(account_id);
`);

// Queries pour hourly_stats
const hourlyQueries = {
  add: db.prepare(`
    INSERT INTO hourly_stats (account_id, total_videos, total_views, delta_videos, delta_views, followers, likes)
    VALUES (@account_id, @total_videos, @total_views, @delta_videos, @delta_views, @followers, @likes)
  `),

  getLatest: db.prepare(`
    SELECT * FROM hourly_stats
    WHERE account_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `),

  getLast24Hours: db.prepare(`
    SELECT * FROM hourly_stats
    WHERE account_id = ?
    AND timestamp >= datetime('now', '-24 hours')
    ORDER BY timestamp DESC
  `),

  getAllLatest: db.prepare(`
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
  `)
};

// Charger les proxies
console.log('🌐 Chargement des proxies...');
const proxiesLoaded = proxyManager.loadFromFile('proxies');
if (!proxiesLoaded) {
  console.log('⚠️ Pas de proxies trouvés, scraping sans proxy');
}

// Fonction pour scraper un compte
const scrapeAccountWithRetry = async (account, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const proxy = proxyManager.getNextProxy();
      const stats = await scrapeAccount(account.platform, account.url, proxy);

      // Récupérer les stats précédentes
      const previousStats = hourlyQueries.getLatest.get(account.id);

      // Calculer les deltas
      const deltaVideos = previousStats
        ? stats.videos - (previousStats.total_videos || 0)
        : stats.videos;

      const deltaViews = previousStats
        ? stats.views - (previousStats.total_views || 0)
        : stats.views;

      // Sauvegarder dans hourly_stats
      hourlyQueries.add.run({
        account_id: account.id,
        total_videos: stats.videos,
        total_views: stats.views,
        delta_videos: deltaVideos,
        delta_views: deltaViews,
        followers: stats.followers || 0,
        likes: stats.likes || 0
      });

      return {
        success: true,
        account,
        stats,
        deltaVideos,
        deltaViews
      };
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          account,
          error: error.message
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Fonction pour générer un rapport Excel
const generateReport = async (results, reportNumber) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rapport');

  // En-têtes
  worksheet.columns = [
    { header: 'Plateforme', key: 'platform', width: 15 },
    { header: 'Username', key: 'username', width: 25 },
    { header: 'Vidéos', key: 'videos', width: 10 },
    { header: 'Vues', key: 'views', width: 15 },
    { header: '+Vidéos', key: 'deltaVideos', width: 10 },
    { header: '+Vues', key: 'deltaViews', width: 15 },
    { header: 'Followers', key: 'followers', width: 15 },
    { header: 'Likes', key: 'likes', width: 15 },
    { header: 'Timestamp', key: 'timestamp', width: 20 }
  ];

  // Données
  results.forEach(result => {
    if (result.success) {
      worksheet.addRow({
        platform: result.account.platform,
        username: result.account.username,
        videos: result.stats.videos,
        views: result.stats.views,
        deltaVideos: result.deltaVideos,
        deltaViews: result.deltaViews,
        followers: result.stats.followers || 0,
        likes: result.stats.likes || 0,
        timestamp: new Date().toLocaleString('fr-FR')
      });
    }
  });

  // Sauvegarder
  const reportsDir = './reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const filename = `${reportsDir}/rapport_${reportNumber}_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
  await workbook.xlsx.writeFile(filename);

  return filename;
};

// Boucle principale
let reportNumber = 1;

const runContinuousScraping = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 Social Media Tracker - Mode Continu               ║
║                                                            ║
║     ⏱️ Intervalle: ${SCRAPE_INTERVAL / 1000 / 60} minutes                           ║
║     ⚙️ Workers: ${WORKERS}                                         ║
║     🌐 Proxies: ${proxyManager.proxies.length} chargés                              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  while (true) {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RAPPORT #${reportNumber}`);
    console.log(`🕐 ${new Date().toLocaleString('fr-FR')}`);
    console.log(`${'='.repeat(60)}\n`);

    // Récupérer tous les comptes
    const accounts = accountQueries.getAll.all();
    console.log(`📱 ${accounts.length} comptes à scraper...\n`);

    // Créer une queue
    const queue = new PQueue({ concurrency: WORKERS });
    const results = [];

    // Ajouter les tâches à la queue
    for (const account of accounts) {
      queue.add(async () => {
        const result = await scrapeAccountWithRetry(account);
        results.push(result);

        if (result.success) {
          console.log(`✅ ${result.account.platform.padEnd(10)} @${result.account.username.padEnd(20)} | ${result.stats.videos} vidéos | ${result.stats.views.toLocaleString()} vues (+${result.deltaViews})`);
        } else {
          console.log(`❌ ${result.account.platform.padEnd(10)} @${result.account.username.padEnd(20)} | Erreur: ${result.error}`);
        }
      });
    }

    // Attendre que tout soit terminé
    await queue.onIdle();

    // Générer le rapport Excel
    console.log(`\n📄 Génération du rapport Excel...`);
    const reportFile = await generateReport(results, reportNumber);
    console.log(`✅ Rapport sauvegardé: ${reportFile}`);

    // Stats
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalViews = results.filter(r => r.success).reduce((sum, r) => sum + r.stats.views, 0);
    const totalDeltaViews = results.filter(r => r.success).reduce((sum, r) => sum + r.deltaViews, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RÉSUMÉ RAPPORT #${reportNumber}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Succès: ${successful}/${accounts.length}`);
    console.log(`❌ Échecs: ${failed}`);
    console.log(`👁️ Vues totales: ${totalViews.toLocaleString()}`);
    console.log(`📈 Vues gagnées: +${totalDeltaViews.toLocaleString()}`);
    console.log(`⏱️ Durée: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`${'='.repeat(60)}\n`);

    reportNumber++;

    // Attendre avant le prochain cycle
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, SCRAPE_INTERVAL - elapsed);

    if (waitTime > 0) {
      console.log(`⏳ Prochain scraping dans ${Math.round(waitTime / 1000 / 60)} minutes...\n`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error);
});

process.on('SIGINT', () => {
  console.log('\n\n⚠️ Arrêt du worker continu...');
  process.exit(0);
});

// Démarrer
runContinuousScraping().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
