// Charger le proxy AVANT tout autre import avec global-agent
const fs = require('fs');
const path = require('path');

// Lire le fichier proxy et configurer global-agent
const proxyFile = path.join(__dirname, 'proxies');
let proxyConfigured = false;

if (fs.existsSync(proxyFile)) {
  const proxyLine = fs.readFileSync(proxyFile, 'utf8').trim().split('\n')[0];
  if (proxyLine && proxyLine.includes('@')) {
    const proxyUrl = `http://${proxyLine}`;

    // Configurer global-agent pour intercepter TOUTES les requêtes
    process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
    process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;
    process.env.GLOBAL_AGENT_NO_PROXY = ''; // Pas d'exceptions

    // Activer global-agent
    require('global-agent/bootstrap');

    proxyConfigured = true;
    console.log(`🌐 Global-Agent activé avec proxy: http://${proxyLine.split('@')[1]}`);
  }
}

const { accountQueries, videoQueries, hourlyQueries, supabase } = require('./database-supabase');
const { scrapeTikTokDetailed } = require('./scrapers');
const proxyManager = require('./proxy-manager');
const PQueue = require('p-queue').default;
const axios = require('axios');

// Configuration
const SCRAPE_INTERVAL = 10 * 1000; // 10 secondes entre chaque cycle (scraping quasi-continu)
const WORKERS = 1; // 1 seul worker pour éviter le rate limiting du proxy

// Note: Les tables sont déjà créées dans Supabase via le schema SQL

// Charger les proxies
console.log('🌐 Chargement des proxies...');
const proxiesLoaded = proxyManager.loadFromFile('proxies');
if (!proxiesLoaded) {
  console.log('⚠️ Pas de proxies trouvés, scraping sans proxy');
}

// Test de diagnostic du proxy au démarrage
const testProxyConnection = async () => {
  const proxy = proxyManager.getNextProxy();

  console.log(`\n🔍 TEST DIAGNOSTIC DU PROXY (Global-Agent)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Proxy: ${proxy ? `${proxy.host}:${proxy.port}` : 'Non configuré'}`);
  console.log(`Auth: ${proxy?.username ? 'Oui' : 'Non'}`);
  console.log(`Global-Agent: ${proxyConfigured ? 'Activé' : 'Désactivé'}`);

  // Test: IP via global-agent (toutes les requêtes passent par le proxy)
  try {
    // Cette requête devrait automatiquement passer par le proxy grâce à global-agent
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 15000 });
    console.log(`\n🌐 IP détectée: ${response.data.ip}`);

    if (proxyConfigured) {
      console.log(`   ✅ Global-Agent fonctionne - toutes les requêtes passent par le proxy!`);
    } else {
      console.log(`   ⚠️ C'est l'IP directe de Railway (proxy non configuré)`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return true;
  } catch (error) {
    console.log(`\n❌ Erreur de connexion: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return false;
  }
};

// Fonction pour scraper un compte TikTok avec détails
const scrapeTikTokAccountDetailed = async (account, maxRetries = 3) => {
  // Délai aléatoire entre 2-5 secondes pour éviter le rate limiting
  const delay = 2000 + Math.random() * 3000;
  await new Promise(resolve => setTimeout(resolve, delay));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const proxy = proxyManager.getNextProxy();

      // Scraper les vidéos détaillées
      const data = await scrapeTikTokDetailed(account.url, proxy);

      // Récupérer les URLs des vidéos existantes pour ce compte
      const existingVideos = await videoQueries.getUrlsByAccount.all(account.id);
      const existingVideoUrls = new Set(existingVideos.map(v => v.video_url));

      let newVideosCount = 0;
      let updatedVideosCount = 0;

      // Traiter chaque vidéo
      for (const video of data.videos) {
        if (!video.video_url) continue;

        const isNewVideo = !existingVideoUrls.has(video.video_url);

        if (isNewVideo) {
          // Nouvelle vidéo - insérer toutes les données
          await videoQueries.upsertFull.run({
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
          await videoQueries.updateMetrics.run({
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
      const previousStats = await hourlyQueries.getLatest.get(account.id);

      const deltaVideos = previousStats
        ? totalVideos - (previousStats.total_videos || 0)
        : totalVideos;

      const deltaViews = previousStats
        ? totalViews - (previousStats.total_views || 0)
        : totalViews;

      // Sauvegarder dans hourly_stats pour compatibilité
      await hourlyQueries.add.run({
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
║     🚀 Social Media Tracker - Mode Continu               ║
║                                                            ║
║     ⏱️ Scraping en BOUCLE (pause: ${SCRAPE_INTERVAL / 1000}s)               ║
║     ⚙️ Workers: ${WORKERS} parallèles                               ║
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
    const allAccounts = await accountQueries.getAll.all();
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
      console.log(`⏳ Prochain scraping dans ${Math.round(waitTime / 1000)}s...\n`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else {
      console.log(`⚡ Lancement immédiat du prochain cycle...\n`);
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

// Démarrer avec test de diagnostic
const start = async () => {
  // Test du proxy au démarrage
  const proxyWorks = await testProxyConnection();

  if (!proxyWorks) {
    console.log('⚠️ Le proxy ne fonctionne pas!');
    console.log('👉 Vérifie que l\'IP directe affichée ci-dessus est whitelistée dans GridPanel');
    console.log('👉 Sur Railway, l\'IP peut changer à chaque déploiement\n');
  }

  // Lancer le scraping même si le proxy échoue (pour voir les erreurs)
  await runDetailedScraping();
};

start().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
