const { accountQueries, videoQueries, db } = require('./database');
const { scrapeTikTokDetailed } = require('./scrapers');
const proxyManager = require('./proxy-manager');
const PQueue = require('p-queue').default;

// Configuration
const SCRAPE_INTERVAL = 60 * 60 * 1000; // 1 heure en millisecondes
const WORKERS = 5; // Réduit car scraping détaillé prend plus de temps

// Créer la table hourly_stats si elle n'existe pas (pour compatibilité)
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
    platform TEXT,
    username TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_hourly_stats_timestamp ON hourly_stats(timestamp);
  CREATE INDEX IF NOT EXISTS idx_hourly_stats_account ON hourly_stats(account_id);
`);

// Queries pour hourly_stats
const hourlyQueries = {
  add: db.prepare(`
    INSERT INTO hourly_stats (account_id, total_videos, total_views, delta_videos, delta_views, followers, likes, platform, username)
    VALUES (@account_id, @total_videos, @total_views, @delta_videos, @delta_views, @followers, @likes, @platform, @username)
  `),

  getLatest: db.prepare(`
    SELECT * FROM hourly_stats
    WHERE account_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `)
};

// Charger les proxies
console.log('🌐 Chargement des proxies...');
const proxiesLoaded = proxyManager.loadFromFile('proxies');
if (!proxiesLoaded) {
  console.log('⚠️ Pas de proxies trouvés, scraping sans proxy');
}

// Fonction pour scraper un compte TikTok avec détails
const scrapeTikTokAccountDetailed = async (account, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const proxy = proxyManager.getNextProxy();

      // Scraper les vidéos détaillées
      const data = await scrapeTikTokDetailed(account.url, proxy);

      // Récupérer les URLs des vidéos existantes pour ce compte
      const existingVideos = videoQueries.getUrlsByAccount.all(account.id);
      const existingVideoUrls = new Set(existingVideos.map(v => v.video_url));

      let newVideosCount = 0;
      let updatedVideosCount = 0;

      // Traiter chaque vidéo
      for (const video of data.videos) {
        if (!video.video_url) continue;

        const isNewVideo = !existingVideoUrls.has(video.video_url);

        if (isNewVideo) {
          // Nouvelle vidéo - insérer toutes les données
          videoQueries.upsertFull.run({
            account_id: account.id,
            video_url: video.video_url,
            video_id: video.video_id,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares,
            saves: video.saves,
            duration: video.duration,
            published_date: video.published_date,
            description: video.description,
            hashtags: video.hashtags,
            audio_name: video.audio_name,
            audio_url: video.audio_url,
            thumbnail_url: video.thumbnail_url
          });
          newVideosCount++;
        } else {
          // Vidéo existante - mettre à jour seulement les metrics
          videoQueries.updateMetrics.run({
            video_url: video.video_url,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            shares: video.shares,
            saves: video.saves
          });
          updatedVideosCount++;
        }
      }

      // Calculer les totaux pour hourly_stats
      const totalVideos = data.totalVideos;
      const totalViews = data.videos.reduce((sum, v) => sum + v.views, 0);

      // Récupérer les stats précédentes pour calculer les deltas
      const previousStats = hourlyQueries.getLatest.get(account.id);

      const deltaVideos = previousStats
        ? totalVideos - (previousStats.total_videos || 0)
        : totalVideos;

      const deltaViews = previousStats
        ? totalViews - (previousStats.total_views || 0)
        : totalViews;

      // Sauvegarder dans hourly_stats pour compatibilité
      hourlyQueries.add.run({
        account_id: account.id,
        total_videos: totalVideos,
        total_views: totalViews,
        delta_videos: deltaVideos,
        delta_views: deltaViews,
        followers: data.profileStats.followers,
        likes: data.profileStats.likes,
        platform: account.platform,
        username: account.username
      });

      return {
        success: true,
        account,
        totalVideos,
        totalViews,
        newVideosCount,
        updatedVideosCount,
        deltaVideos,
        deltaViews,
        followers: data.profileStats.followers,
        likes: data.profileStats.likes
      };
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          account,
          error: error.message
        };
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
};

// Boucle principale
let reportNumber = 1;

const runDetailedScraping = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 Social Media Tracker - Mode Détaillé              ║
║                                                            ║
║     ⏱️ Intervalle: ${SCRAPE_INTERVAL / 1000 / 60} minutes                           ║
║     ⚙️ Workers: ${WORKERS}                                          ║
║     🌐 Proxies: ${proxyManager.proxies.length} chargés                              ║
║     📹 Collecte: Données complètes des vidéos            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  while (true) {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RAPPORT DÉTAILLÉ #${reportNumber}`);
    console.log(`🕐 ${new Date().toLocaleString('fr-FR')}`);
    console.log(`${'='.repeat(60)}\n`);

    // Récupérer tous les comptes TikTok
    const allAccounts = accountQueries.getAll.all();
    const accounts = allAccounts.filter(a => a.platform.toLowerCase() === 'tiktok');

    console.log(`📱 ${accounts.length} comptes TikTok à scraper en détail...\n`);

    // Créer une queue
    const queue = new PQueue({ concurrency: WORKERS });
    const results = [];

    // Ajouter les tâches à la queue
    for (const account of accounts) {
      queue.add(async () => {
        const result = await scrapeTikTokAccountDetailed(account);
        results.push(result);

        if (result.success) {
          console.log(`✅ @${result.account.username.padEnd(20)} | ${result.totalVideos} vidéos | ${result.totalViews.toLocaleString()} vues | 🆕 ${result.newVideosCount} nouvelles | 🔄 ${result.updatedVideosCount} mises à jour`);
        } else {
          console.log(`❌ @${result.account.username.padEnd(20)} | Erreur: ${result.error}`);
        }
      });
    }

    // Attendre que tout soit terminé
    await queue.onIdle();

    // Stats
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalViews = results.filter(r => r.success).reduce((sum, r) => sum + r.totalViews, 0);
    const totalNewVideos = results.filter(r => r.success).reduce((sum, r) => sum + r.newVideosCount, 0);
    const totalUpdatedVideos = results.filter(r => r.success).reduce((sum, r) => sum + r.updatedVideosCount, 0);
    const totalDeltaViews = results.filter(r => r.success).reduce((sum, r) => sum + r.deltaViews, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RÉSUMÉ RAPPORT #${reportNumber}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Succès: ${successful}/${accounts.length}`);
    console.log(`❌ Échecs: ${failed}`);
    console.log(`👁️ Vues totales: ${totalViews.toLocaleString()}`);
    console.log(`📈 Vues gagnées: +${totalDeltaViews.toLocaleString()}`);
    console.log(`🆕 Nouvelles vidéos: ${totalNewVideos}`);
    console.log(`🔄 Vidéos mises à jour: ${totalUpdatedVideos}`);
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
  console.log('\n\n⚠️ Arrêt du worker détaillé...');
  process.exit(0);
});

// Démarrer
runDetailedScraping().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
