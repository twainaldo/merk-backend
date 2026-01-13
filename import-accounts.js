const fs = require('fs');
const csv = require('csv-parser');
const { accountQueries } = require('./database');
const { detectPlatform, extractUsername, parseBulkAccounts } = require('./platform-detector');

// Importer des comptes depuis un fichier CSV
const importFromCSV = async (filePath) => {
  return new Promise((resolve, reject) => {
    const accounts = [];
    let imported = 0;
    let skipped = 0;
    const errors = [];

    console.log(`📥 Import de comptes depuis: ${filePath}\n`);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Support 2 formats:
        // 1. Ancien: platform,username,url
        // 2. Nouveau: username,url (auto-détection) ou juste url

        let { platform, username, url } = row;

        // Format nouveau: auto-détection
        if (!platform && url) {
          try {
            platform = detectPlatform(url);
            if (!username) {
              username = extractUsername(url, platform) || url.split('/').filter(p => p).pop();
            }
          } catch (error) {
            errors.push({ row, error: error.message });
            skipped++;
            return;
          }
        }

        // Validation
        if (!url) {
          errors.push({ row, error: 'URL manquante' });
          skipped++;
          return;
        }

        if (!platform) {
          errors.push({ row, error: 'Impossible de détecter la plateforme' });
          skipped++;
          return;
        }

        // Valider la plateforme
        const validPlatforms = ['TikTok', 'YouTube', 'Instagram', 'Facebook'];
        const platformCap = platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();

        if (!validPlatforms.includes(platformCap)) {
          errors.push({ row, error: `Plateforme invalide: ${platform}` });
          skipped++;
          return;
        }

        accounts.push({
          platform: platformCap,
          username: (username || '').trim(),
          url: url.trim()
        });
      })
      .on('end', () => {
        // Insérer dans la base de données
        console.log(`📊 ${accounts.length} comptes à importer...\n`);

        accounts.forEach((account, index) => {
          try {
            accountQueries.add.run(account);
            imported++;

            if ((index + 1) % 100 === 0) {
              console.log(`   ✓ ${index + 1} comptes importés...`);
            }
          } catch (error) {
            errors.push({ account, error: error.message });
            skipped++;
          }
        });

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ Import terminé`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Importés: ${imported}`);
        console.log(`Ignorés: ${skipped}`);

        if (errors.length > 0) {
          console.log(`\n❌ ${errors.length} erreurs:`);
          errors.slice(0, 10).forEach(err => {
            console.log(`   - ${err.error}`);
          });
          if (errors.length > 10) {
            console.log(`   ... et ${errors.length - 10} autres erreurs`);
          }
        }

        resolve({
          imported,
          skipped,
          errors
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Créer un fichier CSV exemple
const createExampleCSV = (filePath = 'accounts-example.csv') => {
  const exampleData = `url
https://www.tiktok.com/@khaby.lame
https://www.youtube.com/@MrBeast
https://www.instagram.com/cristiano/
https://www.facebook.com/facebook
https://www.tiktok.com/@charlidamelio
https://www.youtube.com/@PewDiePie`;

  fs.writeFileSync(filePath, exampleData);
  console.log(`✅ Fichier exemple créé: ${filePath}`);
  console.log(`\n📋 Format CSV simplifié (auto-détection):`);
  console.log(`  url`);
  console.log(`  https://www.tiktok.com/@username`);
  console.log(`  https://www.youtube.com/@channel`);
  console.log(`\n💡 Ancien format aussi supporté: platform,username,url`);
  console.log(`\n🎯 Plateformes détectées automatiquement:`);
  console.log(`  • TikTok (tiktok.com)`);
  console.log(`  • YouTube (youtube.com, youtu.be)`);
  console.log(`  • Instagram (instagram.com)`);
  console.log(`  • Facebook (facebook.com, fb.com)`);
};

// Importer depuis du texte brut (plusieurs URLs, une par ligne)
const importFromText = async (text) => {
  const results = parseBulkAccounts(text);
  let imported = 0;
  const errors = [];

  console.log(`\n📥 Import de ${results.success.length} comptes...\n`);

  results.success.forEach((account, index) => {
    try {
      accountQueries.add.run({
        platform: account.platform,
        username: account.username,
        url: account.url
      });
      imported++;

      if ((index + 1) % 100 === 0) {
        console.log(`   ✓ ${index + 1} comptes importés...`);
      }
    } catch (error) {
      errors.push({ account, error: error.message });
    }
  });

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Import terminé`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Importés: ${imported}`);
  console.log(`Ignorés: ${results.errors.length + errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Erreurs de parsing:`);
    results.errors.slice(0, 5).forEach(err => {
      console.log(`   Ligne ${err.line}: ${err.error}`);
    });
    if (results.errors.length > 5) {
      console.log(`   ... et ${results.errors.length - 5} autres erreurs`);
    }
  }

  return {
    imported,
    skipped: results.errors.length + errors.length,
    errors: [...results.errors, ...errors]
  };
};

// Si le script est exécuté directement
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node import-accounts.js <fichier.csv>     Importer des comptes depuis un CSV
  node import-accounts.js --example         Créer un fichier exemple

Exemple:
  node import-accounts.js accounts.csv
  node import-accounts.js --example
    `);
    process.exit(1);
  }

  if (args[0] === '--example') {
    createExampleCSV();
    process.exit(0);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable: ${filePath}`);
    process.exit(1);
  }

  importFromCSV(filePath)
    .then((results) => {
      console.log(`\n✓ Import terminé avec succès`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`\n❌ Erreur lors de l'import:`, error);
      process.exit(1);
    });
}

module.exports = { importFromCSV, importFromText, createExampleCSV };
