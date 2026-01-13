# Guide de Démarrage Rapide

## Installation terminée ✅

Les dépendances sont déjà installées. Tu es prêt à commencer!

## Démarrage en 3 étapes

### 1. Démarrer le serveur

```bash
source ~/.nvm/nvm.sh && nvm use default && npm start
```

Ouvre ton navigateur: **http://localhost:3000**

### 2. Importer tes comptes

**Option A: Via l'interface web**
- Clique sur "Ajouter un compte"
- Remplis le formulaire
- Répète pour chaque compte

**Option B: Import CSV massif (RECOMMANDÉ pour 100+ comptes)**

```bash
# Créer un fichier exemple
node import-accounts.js --example

# Éditer accounts-example.csv avec tes comptes
# Format: platform,username,url

# Importer
node import-accounts.js accounts-example.csv
```

### 3. Lancer le premier scraping

**Option A: Via l'interface**
- Clique sur "Scraper maintenant"

**Option B: En ligne de commande**
```bash
npm run worker
```

## Système Automatique 24/7

### Avec PM2 (Production)

```bash
# Installer PM2
npm install -g pm2

# Démarrer en mode daemon
pm2 start server.js --name social-tracker

# Voir les logs
pm2 logs social-tracker

# Monitoring
pm2 monit

# Arrêter
pm2 stop social-tracker
```

Le système va automatiquement:
- Scraper à 9h00 (matin) + générer rapport
- Scraper à 21h00 (soir) + générer rapport
- Rafraîchir les proxies toutes les heures

## Rapports

Les rapports Excel seront générés dans le dossier `reports/`

Télécharge-les via:
- Interface web: Section "Rapports"
- Directement: `http://localhost:3000/reports/`

## Configuration

Créer `.env` pour personnaliser:

```bash
cp .env.example .env
nano .env
```

Paramètres importants:
```env
WORKER_CONCURRENCY=10      # Augmenter pour plus de vitesse
USE_PROXIES=true           # false pour tester sans proxies
CRON_MORNING=0 9 * * *     # Changer l'heure du matin
CRON_EVENING=0 21 * * *    # Changer l'heure du soir
```

## Performance

### Pour 100 comptes
- Workers: 10 (par défaut)
- Temps: ~5-10 minutes
- Proxies: Activés

### Pour 500 comptes
- Workers: 15-20
  ```env
  WORKER_CONCURRENCY=15
  ```
- Temps: ~30-60 minutes
- Proxies: Obligatoires

### Pour 1000 comptes
- Workers: 20
  ```env
  WORKER_CONCURRENCY=20
  ```
- Temps: ~1-2 heures
- Proxies: Obligatoires
- Considérer VPS (DigitalOcean, Hetzner)

## Monitoring

### Stats en temps réel

```bash
curl http://localhost:3000/api/queue/status
```

### Logs

```bash
# Avec PM2
pm2 logs social-tracker

# Sans PM2
# Les logs s'affichent dans le terminal
```

## Problèmes Courants

### "npm: command not found"

```bash
source ~/.nvm/nvm.sh && nvm use default
```

### Scraping échoue

```bash
# Tester sans proxies
echo "USE_PROXIES=false" > .env
npm start
```

### Port 3000 déjà utilisé

```bash
# Changer le port
echo "PORT=3001" >> .env
npm start
```

### Mémoire insuffisante

```bash
# Réduire les workers
echo "WORKER_CONCURRENCY=5" >> .env
npm start
```

## Commandes Utiles

```bash
# Créer fichier CSV exemple
node import-accounts.js --example

# Importer CSV
node import-accounts.js mes-comptes.csv

# Scraping manuel
npm run worker

# Générer rapport
node report-generator.js

# Mode dev (auto-reload)
npm run dev
```

## URLs Importantes

- **Interface**: http://localhost:3000
- **API Docs**: [README.md](README.md#api-endpoints)
- **Rapports**: http://localhost:3000/reports/

## Prochaines Étapes

1. ✅ Serveur démarré
2. ⬜ Importer 10-20 comptes de test
3. ⬜ Lancer premier scraping
4. ⬜ Vérifier les résultats dans l'interface
5. ⬜ Importer tous tes comptes (CSV)
6. ⬜ Configurer PM2 pour 24/7
7. ⬜ Profiter des rapports quotidiens automatiques!

## Support

Questions? Lis le [README complet](README.md)

---

**Bonne chance! 🚀**
