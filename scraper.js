const { accountQueries, statsQueries } = require('./database');
const { scrapeAccount } = require('./scrapers');

// Fonction pour calculer les nouvelles vidéos et vues
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

// Fonction principale de scraping
const runDailyScrape = async () => {
  const accounts = accountQueries.getAll.all();
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n🚀 Début du scraping quotidien - ${today}`);
  console.log(`📊 ${accounts.length} compte(s) à scraper\n`);

  const results = {
    success: [],
    errors: []
  };

  for (const account of accounts) {
    try {
      console.log(`\n📱 ${account.platform} - @${account.username}`);
      console.log(`   URL: ${account.url}`);

      // Scraper les données
      const scrapedData = await scrapeAccount(account.platform, account.url);
      console.log(`   ✓ Vidéos: ${scrapedData.videos}`);
      console.log(`   ✓ Vues totales: ${scrapedData.views.toLocaleString()}`);

      // Récupérer les stats précédentes
      const previousStats = statsQueries.getLatest.get(account.id);

      // Calculer les nouvelles stats
      const newStats = calculateNewStats(scrapedData, previousStats);
      console.log(`   📈 Nouvelles vidéos: ${newStats.new_videos}`);
      console.log(`   📈 Nouvelles vues: ${newStats.new_views.toLocaleString()}`);

      // Sauvegarder dans la base de données
      statsQueries.add.run({
        account_id: account.id,
        date: today,
        total_videos: scrapedData.videos,
        total_views: scrapedData.views,
        new_videos: newStats.new_videos,
        new_views: newStats.new_views
      });

      results.success.push({
        platform: account.platform,
        username: account.username,
        ...scrapedData,
        ...newStats
      });

      console.log(`   ✅ Données sauvegardées`);

      // Pause entre chaque scraping pour éviter les rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`);
      results.errors.push({
        platform: account.platform,
        username: account.username,
        error: error.message
      });
    }
  }

  // Résumé
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Succès: ${results.success.length}/${accounts.length}`);
  console.log(`❌ Erreurs: ${results.errors.length}/${accounts.length}`);
  console.log(`${'='.repeat(50)}\n`);

  return results;
};

// Si le script est exécuté directement
if (require.main === module) {
  runDailyScrape()
    .then(() => {
      console.log('✓ Scraping terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Erreur lors du scraping:', error);
      process.exit(1);
    });
}

module.exports = { runDailyScrape };
