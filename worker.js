const QueueManager = require('./queue-manager');
const proxyManager = require('./proxy-manager');
const { scrapeAccount } = require('./scrapers');
const { statsQueries } = require('./database');

// Configuration
const CONCURRENCY = process.env.WORKER_CONCURRENCY || 10;
const USE_PROXIES = process.env.USE_PROXIES !== 'false'; // Par défaut activé

// Créer la queue
const queueManager = new QueueManager({
  concurrency: CONCURRENCY,
  retryAttempts: 3,
  retryDelay: 5000
});

// Calculer les nouvelles stats
const calculateNewStats = (currentStats, previousStats) => {
  if (!previousStats) {
    return {
      new_videos: currentStats.videos,
      new_views: currentStats.views
    };
  }

  return {
    new_videos: Math.max(0, currentStats.videos - previousStats.total_videos),
    new_views: Math.max(0, currentStats.views - previousStats.total_views)
  };
};

// Fonction de scraping avec proxy
const scrapeWithProxy = async (account) => {
  let proxy = null;
  let scrapedData = null;
  let attempts = 0;
  const maxProxyAttempts = 3;

  while (attempts < maxProxyAttempts) {
    try {
      // Obtenir un proxy si activé
      if (USE_PROXIES) {
        proxy = proxyManager.getNextProxy();
        if (proxy) {
          console.log(`   🌐 Utilisation du proxy ${proxy.host}:${proxy.port}`);
        }
      }

      // Scraper avec ou sans proxy
      scrapedData = await scrapeAccount(account.platform, account.url, proxy);

      // Succès
      break;

    } catch (error) {
      attempts++;

      // Si le proxy a échoué
      if (proxy && USE_PROXIES) {
        proxyManager.markProxyAsFailed(proxy);
        console.log(`   ⚠️ Proxy échoué, tentative ${attempts}/${maxProxyAttempts}`);

        if (attempts < maxProxyAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }

      throw error;
    }
  }

  if (!scrapedData) {
    throw new Error('Échec du scraping après plusieurs tentatives');
  }

  return scrapedData;
};

// Fonction de scraping complète avec sauvegarde
const scrapeAndSave = async (account) => {
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n📱 ${account.platform} - @${account.username}`);

  // Scraper les données
  const scrapedData = await scrapeWithProxy(account);
  console.log(`   ✓ Vidéos: ${scrapedData.videos}`);
  console.log(`   ✓ Vues: ${scrapedData.views.toLocaleString()}`);

  // Récupérer les stats précédentes
  const previousStats = statsQueries.getLatest.get(account.id);

  // Calculer les nouvelles stats
  const newStats = calculateNewStats(scrapedData, previousStats);
  console.log(`   📈 +${newStats.new_videos} vidéos, +${newStats.new_views.toLocaleString()} vues`);

  // Sauvegarder dans la base de données
  statsQueries.add.run({
    account_id: account.id,
    date: today,
    total_videos: scrapedData.videos,
    total_views: scrapedData.views,
    new_videos: newStats.new_videos,
    new_views: newStats.new_views
  });

  return {
    ...scrapedData,
    ...newStats
  };
};

// Événements de la queue
queueManager.on('job:start', ({ account }) => {
  // Job démarré
});

queueManager.on('job:complete', ({ account, result }) => {
  console.log(`✅ ${account.platform} @${account.username} - Terminé`);
});

queueManager.on('job:error', ({ account, error }) => {
  console.error(`❌ ${account.platform} @${account.username} - Erreur: ${error.message}`);
});

// Fonction principale
const runWorker = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 Social Media Tracker - Worker                      ║
║                                                            ║
║     ⚙️ Workers: ${CONCURRENCY.toString().padEnd(44)} ║
║     🌐 Proxies: ${USE_PROXIES ? 'Activés'.padEnd(44) : 'Désactivés'.padEnd(44)} ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Charger les proxies si activés
  if (USE_PROXIES) {
    await proxyManager.fetchFreeProxies();
  }

  // Lancer le scraping de tous les comptes
  const results = await queueManager.queueAllAccounts(scrapeAndSave);

  // Afficher les résultats
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RÉSULTATS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${results.stats.total}`);
  console.log(`✅ Succès: ${results.stats.completed}`);
  console.log(`❌ Échecs: ${results.stats.failed}`);
  console.log(`📈 Taux de réussite: ${results.stats.successRate}`);
  console.log(`⏱️ Durée: ${results.stats.durationFormatted}`);
  console.log(`${'='.repeat(60)}\n`);

  if (USE_PROXIES) {
    const proxyStats = proxyManager.getStats();
    console.log(`🌐 Stats Proxies:`);
    console.log(`   Total: ${proxyStats.total}`);
    console.log(`   Actifs: ${proxyStats.active}`);
    console.log(`   Défaillants: ${proxyStats.failed}\n`);
  }

  return results;
};

// Si le script est exécuté directement
if (require.main === module) {
  runWorker()
    .then(() => {
      console.log('✓ Worker terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Erreur worker:', error);
      process.exit(1);
    });
}

module.exports = { runWorker, queueManager, scrapeAndSave };
