const { accountQueries, videoQueries, db } = require('./database');
const { scrapeTikTokDetailed } = require('./scrapers');
const proxyManager = require('./proxy-manager');

// Charger les proxies
console.log('🌐 Chargement des proxies...');
const proxiesLoaded = proxyManager.loadFromFile('proxies');
console.log(`✅ ${proxyManager.proxies.length} proxies chargés\n`);

// Test sur un compte
const testDetailedScraping = async () => {
  console.log('🧪 Test du scraping détaillé\n');

  // Récupérer le premier compte TikTok
  const allAccounts = accountQueries.getAll.all();
  const tiktokAccounts = allAccounts.filter(a => a.platform.toLowerCase() === 'tiktok');

  if (tiktokAccounts.length === 0) {
    console.log('❌ Aucun compte TikTok trouvé');
    return;
  }

  const account = tiktokAccounts[0];
  console.log(`📱 Test avec: @${account.username}`);
  console.log(`🔗 URL: ${account.url}\n`);

  try {
    const proxy = proxyManager.getNextProxy();

    // Scraper les vidéos détaillées
    console.log('⏳ Scraping en cours...\n');
    const data = await scrapeTikTokDetailed(account.url, proxy);

    console.log(`✅ Scraping terminé!`);
    console.log(`📊 Profil:`);
    console.log(`   - Followers: ${data.profileStats.followers.toLocaleString()}`);
    console.log(`   - Likes: ${data.profileStats.likes.toLocaleString()}`);
    console.log(`\n📹 Vidéos trouvées: ${data.videos.length}\n`);

    // Afficher les 3 premières vidéos avec tous les détails
    console.log('🎬 Aperçu des premières vidéos:\n');
    data.videos.slice(0, 3).forEach((video, index) => {
      console.log(`Vidéo ${index + 1}:`);
      console.log(`  📈 Vues: ${video.views.toLocaleString()}`);
      console.log(`  ❤️ Likes: ${video.likes.toLocaleString()}`);
      console.log(`  💬 Commentaires: ${video.comments.toLocaleString()}`);
      console.log(`  🔄 Shares: ${video.shares.toLocaleString()}`);
      console.log(`  💾 Saves: ${video.saves.toLocaleString()}`);
      console.log(`  ⏱️ Durée: ${video.duration}s`);
      console.log(`  📅 Date: ${video.published_date ? new Date(video.published_date * 1000).toLocaleDateString('fr-FR') : 'N/A'}`);
      console.log(`  📝 Description: ${video.description.substring(0, 50)}${video.description.length > 50 ? '...' : ''}`);
      console.log(`  🏷️ Hashtags: ${video.hashtags || 'Aucun'}`);
      console.log(`  🎵 Audio: ${video.audio_name.substring(0, 50)}${video.audio_name.length > 50 ? '...' : ''}`);
      console.log(`  🔗 URL: ${video.video_url.substring(0, 50)}...`);
      console.log('');
    });

    // Récupérer les URLs des vidéos existantes
    const existingVideos = videoQueries.getUrlsByAccount.all(account.id);
    const existingVideoUrls = new Set(existingVideos.map(v => v.video_url));

    console.log(`\n🗄️ Traitement de la base de données:\n`);

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

    console.log(`🆕 Nouvelles vidéos insérées: ${newVideosCount}`);
    console.log(`🔄 Vidéos mises à jour: ${updatedVideosCount}`);

    // Vérifier les données dans la base
    const videosInDb = videoQueries.getByAccount.all(account.id);
    console.log(`\n💾 Total vidéos en base pour ce compte: ${videosInDb.length}`);

    // Afficher les 3 vidéos les plus vues
    console.log(`\n🏆 Top 3 vidéos les plus vues:\n`);
    const topVideos = videoQueries.getTopVideos.all(3);
    topVideos.forEach((video, index) => {
      console.log(`${index + 1}. @${video.username}`);
      console.log(`   📈 ${video.views.toLocaleString()} vues`);
      console.log(`   ❤️ ${video.likes.toLocaleString()} likes`);
      console.log(`   📝 ${video.description.substring(0, 60)}...`);
      console.log('');
    });

    console.log('✅ Test terminé avec succès!');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
};

testDetailedScraping();
