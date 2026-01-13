// Script de test pour vérifier le scraping
const { scrapeAccount } = require('./scrapers');

// Exemples de comptes à tester
const testAccounts = [
  {
    platform: 'TikTok',
    url: 'https://www.tiktok.com/@khaby.lame', // Compte populaire pour tester
    username: '@khaby.lame'
  },
  // Décommenter pour tester d'autres plateformes
  // {
  //   platform: 'YouTube',
  //   url: 'https://www.youtube.com/@MrBeast',
  //   username: '@MrBeast'
  // }
];

const runTest = async () => {
  console.log('🧪 Test du système de scraping\n');

  for (const account of testAccounts) {
    try {
      console.log(`\n📱 Test ${account.platform} - ${account.username}`);
      console.log(`   URL: ${account.url}`);
      console.log('   Scraping en cours...\n');

      const stats = await scrapeAccount(account.platform, account.url);

      console.log('   ✅ Résultats:');
      console.log(`   📹 Vidéos: ${stats.videos}`);
      console.log(`   👁️  Vues: ${stats.views.toLocaleString()}`);
      console.log('');
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}\n`);
    }
  }

  console.log('✓ Tests terminés');
};

runTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur:', error);
    process.exit(1);
  });
