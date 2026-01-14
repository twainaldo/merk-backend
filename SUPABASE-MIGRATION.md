# 🚀 Migration vers Supabase

Ce guide explique comment migrer de SQLite vers Supabase pour une base de données cloud fiable.

## ✅ Avantages de Supabase

- **Base de données cloud** - PostgreSQL hébergé, jamais de perte de données
- **Interface UI** - Voir/ajouter/supprimer des comptes via l'interface Supabase
- **API REST automatique** - Supabase génère des APIs
- **Real-time** - Le frontend peut s'abonner aux changements en temps réel
- **Gratuit** jusqu'à 500MB + 2GB bande passante
- **Backup automatique**

---

## 📦 Étape 1: Créer un projet Supabase

1. Va sur [supabase.com](https://supabase.com)
2. Clique sur "New Project"
3. Choisis un nom: `merk-analytics`
4. Choisis un mot de passe fort pour la base de données
5. Sélectionne une région proche (ex: Europe West)
6. Clique sur "Create new project"
7. Attends 2-3 minutes que le projet soit prêt

---

## 🗄️ Étape 2: Créer les tables

1. Dans Supabase, va dans **SQL Editor** (icône à gauche)
2. Clique sur "New Query"
3. Copie-colle le contenu de `supabase-schema.sql`
4. Clique sur "Run" (ou Cmd+Enter)
5. Tu devrais voir: "Success. No rows returned"

Les tables créées:
- `accounts` - Liste des comptes à scraper
- `videos` - Données détaillées de chaque vidéo
- `hourly_stats` - Statistiques horaires par compte

---

## 🔑 Étape 3: Récupérer les clés API

1. Dans Supabase, va dans **Settings** → **API**
2. Tu vas voir deux sections importantes:

### URL du projet
```
URL: https://xxxxxxxxxxx.supabase.co
```

### API Keys
- **anon public**: Pour le frontend (Next.js)
- **service_role**: Pour le backend (Railway) ⚠️ GARDEZ SECRÈTE

3. Copie ces deux valeurs

---

## ⚙️ Étape 4: Configurer le Backend (Railway)

1. Va sur [railway.app](https://railway.app)
2. Ouvre ton projet `merk-backend`
3. Va dans l'onglet **Variables**
4. Ajoute ces variables:

```env
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3000
NODE_ENV=production
```

5. Railway va automatiquement redéployer avec Supabase !

---

## 🎨 Étape 5: Configurer le Frontend (Vercel)

Le frontend utilise déjà l'API backend, donc aucune modification nécessaire !

Mais si tu veux accéder directement à Supabase depuis le frontend (optionnel):

1. Va sur [vercel.com](https://vercel.com)
2. Ouvre ton projet `merk-analytics`
3. Va dans **Settings** → **Environment Variables**
4. Ajoute (optionnel):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔄 Étape 6: Migrer les données existantes (Optionnel)

Si tu as des comptes dans SQLite que tu veux garder:

### Option A - Ajouter via l'API

Utilise le fichier `add-accounts.json`:

```bash
curl -X POST https://web-production-7208f.up.railway.app/api/accounts/bulk \
  -H "Content-Type: application/json" \
  -d @add-accounts.json
```

### Option B - Ajouter via l'interface Supabase

1. Va dans **Table Editor** → `accounts`
2. Clique sur "Insert" → "Insert row"
3. Remplis:
   - `platform`: tiktok
   - `username`: khaby.lame
   - `url`: https://www.tiktok.com/@khaby.lame
4. Clique sur "Save"

---

## ✅ Étape 7: Vérifier que tout fonctionne

### Backend Railway

1. Va dans **Deployments** → Logs
2. Tu devrais voir:
```
📊 Supabase client initialized: https://xxxxxxxxxxx.supabase.co
🚀 Social Media Tracker - Mode Continu
```

3. Pas d'erreur de connexion Supabase

### Frontend Vercel

1. Ouvre https://merk-analytics.vercel.app
2. Tu devrais voir les comptes affichés
3. Les stats se mettent à jour

### Supabase Dashboard

1. Va dans **Table Editor** → `accounts`
2. Tu devrais voir tes comptes
3. Va dans `hourly_stats` → Tu devrais voir les stats se remplir automatiquement

---

## 🎯 Prochaines étapes

Maintenant que Supabase est configuré:

- ✅ Les données persistent pour toujours
- ✅ Tu peux voir/modifier les comptes via l'interface Supabase
- ✅ Le scraping continu remplit automatiquement `videos` et `hourly_stats`
- ✅ Backup automatique de la base de données

---

## 🐛 Troubleshooting

### Erreur: "SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis"

→ Tu n'as pas ajouté les variables d'environnement dans Railway. Retourne à l'Étape 4.

### Erreur: "Failed to fetch"

→ Vérifie que les Row Level Security (RLS) policies sont bien créées. Retourne à l'Étape 2 et re-run le schema SQL.

### Les données n'apparaissent pas

→ Vérifie les logs Railway. Le worker doit scraper et insérer des données. Attends 1-2 minutes après le premier scraping.

### Erreur: "relation 'accounts' does not exist"

→ Les tables n'ont pas été créées. Retourne à l'Étape 2 et exécute le schema SQL.

---

## 📖 Documentation

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

Migration vers Supabase terminée ! 🎉
