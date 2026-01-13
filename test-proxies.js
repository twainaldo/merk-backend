const proxyManager = require('./proxy-manager');
const axios = require('axios');
const fs = require('fs');

// Tester un proxy en essayant de fetch plusieurs plateformes
const testProxy = async (proxy, timeout = 15000) => {
  const proxyUrl = proxyManager.getProxyUrl(proxy);

  // Tester sur plusieurs URLs (YouTube est moins strict que TikTok)
  const testUrls = [
    'https://www.youtube.com',
    'https://www.tiktok.com',
    'https://www.instagram.com'
  ];

  for (const url of testUrls) {
    try {
      const startTime = Date.now();

      const response = await axios.get(url, {
        timeout,
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
        return {
          success: true,
          responseTime,
          proxy,
          testedOn: url
        };
      }
    } catch (error) {
      // Continuer avec l'URL suivante
      continue;
    }
  }

  return { success: false, error: 'Aucune URL accessible' };
};

// Tester plusieurs proxies en parallèle
const testProxiesInBatch = async (proxies, batchSize = 30) => {
  const goodProxies = [];
  const totalBatches = Math.ceil(proxies.length / batchSize);

  console.log(`\n🧪 Test de ${proxies.length} proxies par batch de ${batchSize}...\n`);

  for (let i = 0; i < totalBatches; i++) {
    const batch = proxies.slice(i * batchSize, (i + 1) * batchSize);
    console.log(`📦 Batch ${i + 1}/${totalBatches} - Test de ${batch.length} proxies...`);

    const results = await Promise.allSettled(
      batch.map(proxy => testProxy(proxy, 15000))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const { proxy, responseTime, testedOn } = result.value;
        goodProxies.push({ ...proxy, responseTime, testedOn });
        const platform = testedOn.includes('youtube') ? '📺 YouTube' :
                        testedOn.includes('tiktok') ? '🎵 TikTok' :
                        testedOn.includes('instagram') ? '📸 Instagram' : '🌐 Web';
        console.log(`   ✅ ${proxy.host}:${proxy.port} - ${responseTime}ms (${platform})`);
      }
    });

    console.log(`   Batch ${i + 1}: ${goodProxies.length} bons proxies trouvés\n`);

    // Petite pause entre les batches
    if (i < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return goodProxies;
};

// Sauvegarder les bons proxies dans un fichier
const saveGoodProxies = (proxies, filename = 'good-proxies.json') => {
  // Trier par temps de réponse
  const sorted = proxies.sort((a, b) => a.responseTime - b.responseTime);

  fs.writeFileSync(filename, JSON.stringify(sorted, null, 2));
  console.log(`\n💾 ${sorted.length} bons proxies sauvegardés dans ${filename}`);

  // Créer aussi un fichier texte simple
  const textFile = filename.replace('.json', '.txt');
  const textContent = sorted.map(p => `${p.protocol}://${p.host}:${p.port}`).join('\n');
  fs.writeFileSync(textFile, textContent);
  console.log(`💾 Liste texte sauvegardée dans ${textFile}\n`);

  return sorted;
};

// Charger les bons proxies depuis le fichier
const loadGoodProxies = (filename = 'good-proxies.json') => {
  if (!fs.existsSync(filename)) {
    return null;
  }

  const data = fs.readFileSync(filename, 'utf8');
  const proxies = JSON.parse(data);
  console.log(`📂 ${proxies.length} bons proxies chargés depuis ${filename}`);
  return proxies;
};

// Fonction principale
const main = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🧪 Test & Filtrage de Proxies                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Vérifier si on a déjà des bons proxies
  const existingGoodProxies = loadGoodProxies();

  if (existingGoodProxies && existingGoodProxies.length > 0) {
    console.log(`\n💡 Tu as déjà ${existingGoodProxies.length} bons proxies testés.`);
    console.log(`   Relancer le test ? (Ctrl+C pour annuler, Enter pour continuer)\n`);

    // Attendre 5 secondes avant de continuer
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Charger les proxies
  console.log('📡 Chargement des proxies gratuits...\n');
  await proxyManager.fetchFreeProxies();
  const stats = proxyManager.getStats();

  console.log(`✅ ${stats.total} proxies chargés`);
  console.log(`\n🎯 Début des tests...\n`);

  // Tester les proxies (2000 pour maximiser les chances de trouver des bons)
  const proxiesToTest = proxyManager.proxies.slice(0, 2000);
  const goodProxies = await testProxiesInBatch(proxiesToTest, 30);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RÉSULTATS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Testés: ${proxiesToTest.length}`);
  console.log(`✅ Fonctionnels: ${goodProxies.length} (${((goodProxies.length / proxiesToTest.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Défaillants: ${proxiesToTest.length - goodProxies.length}`);

  if (goodProxies.length > 0) {
    console.log(`\n🏆 Top 10 proxies les plus rapides:`);
    goodProxies.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.host}:${p.port} - ${p.responseTime}ms`);
    });
  }

  console.log(`${'='.repeat(60)}\n`);

  // Sauvegarder
  if (goodProxies.length > 0) {
    saveGoodProxies(goodProxies);
  }

  console.log('✓ Test terminé!\n');
};

// Si exécuté directement
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = {
  testProxy,
  testProxiesInBatch,
  saveGoodProxies,
  loadGoodProxies
};
