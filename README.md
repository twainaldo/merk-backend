# Social Media Tracker - Backend API

Backend Express.js avec scraping TikTok 24/7 et reporting automatique.

## Features

- 🎯 Scraping TikTok avec API @tobyg74/tiktok-api-dl
- 🌐 100 proxies Proxyscrape premium rotatifs
- ⚡ 10 workers parallèles
- 📊 Rapports Excel automatiques
- 🔄 Tracking continu 24/7 (toutes les 60 min)
- 📈 Historique horaire des stats

## Tech Stack

- Node.js + Express
- SQLite (better-sqlite3)
- p-queue pour la gestion de la queue
- ExcelJS pour les rapports
- node-cron pour les jobs programmés

## Déploiement Railway

1. Créer un compte sur [Railway.app](https://railway.app)
2. Connecter ce repo GitHub
3. Railway va auto-détecter Node.js
4. Ajouter ces variables d'environnement:
   - `PORT`: 3000
   - `WORKER_CONCURRENCY`: 10
5. Deploy!

Le continuous worker va tourner en arrière-plan 24/7.

## API Endpoints

- `GET /api/accounts` - Liste des comptes
- `POST /api/accounts/bulk` - Bulk add accounts
- `GET /api/hourly-stats` - Stats horaires
- `GET /api/dashboard/realtime` - Dashboard en temps réel
- `POST /api/scrape` - Lancer un scraping manuel
- `GET /api/continuous-reports` - Liste des rapports générés

## Local Development

```bash
npm install
npm start  # Lance le serveur API
npm run continuous  # Lance le worker continu
```
