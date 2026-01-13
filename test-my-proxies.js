const proxyManager = require('./proxy-manager');
const axios = require('axios');

// Tester tous les proxies du fichier proxies
const testMyProxies = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🧪 Test de VOS Proxies                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Charger les proxies du fichier
  const loaded = proxyManager.loadFromFile('proxies');

  if (!loaded) {
    console.error('❌ Impossible de charger le fichier proxies');
    process.exit(1);
  }

  const stats = proxyManager.getStats();
  console.log(`✅ ${stats.total} proxies chargés\n`);
  console.log(`🎯 Test de chaque proxy...\n`);

  let working = 0;
  let failed = 0;
  const workingProxies = [];

  // Tester chaque proxy
  for (let i = 0; i < proxyManager.proxies.length; i++) {
    const proxy = proxyManager.proxies[i];
    process.stdout.write(`[${i + 1}/${proxyManager.proxies.length}] ${proxy.host}:${proxy.port} ... `);

    try {
      const startTime = Date.now();

      // Test sur TikTok
      const response = await axios.get('https://www.tiktok.com', {
        timeout: 10000,
        proxy: {
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        maxRedirects: 5
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        console.log(`✅ OK (${responseTime}ms)`);
        working++;
        workingProxies.push({ ...proxy, responseTime });
      } else {
        console.log(`❌ Status ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${error.message.substring(0, 50)}`);
      failed++;
    }

    // Pause de 100ms entre chaque test
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RÉSULTATS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${stats.total}`);
  console.log(`✅ Fonctionnels: ${working} (${((working / stats.total) * 100).toFixed(1)}%)`);
  console.log(`❌ Défaillants: ${failed}`);
  console.log(`${'='.repeat(60)}\n`);

  if (working > 0) {
    // Trier par temps de réponse
    const sorted = workingProxies.sort((a, b) => a.responseTime - b.responseTime);

    console.log(`🏆 Top 10 proxies les plus rapides:`);
    sorted.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.host}:${p.port} - ${p.responseTime}ms`);
    });

    // Sauvegarder
    const fs = require('fs');
    fs.writeFileSync('working-proxies.json', JSON.stringify(sorted, null, 2));
    console.log(`\n💾 ${working} proxies fonctionnels sauvegardés dans working-proxies.json`);
  }

  console.log('\n✓ Test terminé!\n');
};

// Si exécuté directement
if (require.main === module) {
  testMyProxies()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = { testMyProxies };
