# 🚀 Guide de Déploiement Merk Analytics

## Architecture

- **Frontend (Next.js)** → Vercel (gratuit)
- **Backend + Worker** → Railway ($5/mois)

---

## 📦 Partie 1: Déployer le Backend sur Railway

### Étape 1: Créer un compte Railway

1. Va sur [railway.app](https://railway.app)
2. Clique sur "Start a New Project"
3. Connecte ton compte GitHub

### Étape 2: Créer un nouveau projet

1. Clique sur "Deploy from GitHub repo"
2. Sélectionne le repo qui contient `/Users/twain/Makto Data`
3. Railway va détecter automatiquement Node.js

### Étape 3: Configurer les variables d'environnement

Dans Railway, va dans l'onglet "Variables" et ajoute:

```
NODE_ENV=production
PORT=3000
```

### Étape 4: Ajouter le fichier proxies

Railway va avoir besoin du fichier `proxies` pour fonctionner.

**Option A - Via Railway Dashboard:**
1. Va dans l'onglet "Data" ou "Volumes"
2. Upload le fichier `proxies`

**Option B - Commit le fichier:**
```bash
cd "/Users/twain/Makto Data"
git add proxies
git commit -m "Add proxies for deployment"
git push
```

### Étape 5: Déployer

1. Railway va automatiquement déployer
2. Attends 2-3 minutes
3. Tu verras une URL comme `https://merk-backend-production.up.railway.app`

### Étape 6: Vérifier le déploiement

Ouvre l'URL Railway + `/api/health`:
```
https://ton-url.railway.app/api/health
```

Tu devrais voir: `{"status":"ok"}`

---

## 🎨 Partie 2: Déployer le Frontend sur Vercel

### Étape 1: Préparer le repo frontend

```bash
cd "/Users/twain/Merk/merk-analytics"

# Vérifier que c'est un repo git
git status

# Si pas encore de repo:
git init
git add .
git commit -m "Initial commit - Merk Analytics Frontend"
```

### Étape 2: Push sur GitHub

```bash
# Créer un nouveau repo sur GitHub (github.com/new)
# Puis:
git remote add origin https://github.com/TON-USERNAME/merk-analytics.git
git branch -M main
git push -u origin main
```

### Étape 3: Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com)
2. Clique sur "New Project"
3. Connecte ton compte GitHub
4. Sélectionne le repo `merk-analytics`
5. Vercel détecte automatiquement Next.js

### Étape 4: Configurer les variables d'environnement

Dans Vercel, ajoute la variable d'environnement:

```
Name: NEXT_PUBLIC_API_URL
Value: https://ton-url.railway.app
```

(Remplace par l'URL exacte de ton backend Railway)

### Étape 5: Déployer

1. Clique sur "Deploy"
2. Attends 2-3 minutes
3. Tu auras une URL comme `https://merk-analytics.vercel.app`

---

## ✅ Vérification Finale

### Backend Railway:

1. API fonctionne: `https://ton-backend.railway.app/api/health`
2. Logs montrent le worker qui scrape: Railway Dashboard → Logs
3. Tu devrais voir toutes les heures:
   ```
   📊 RAPPORT DÉTAILLÉ #X
   ✅ @username | X vidéos | X,XXX vues
   ```

### Frontend Vercel:

1. Ouvre `https://ton-frontend.vercel.app`
2. Tu devrais voir le dashboard avec les données
3. Les stats se rafraîchissent toutes les 60 secondes

---

## 🔧 Commandes Utiles

### Voir les logs Railway:
Railway Dashboard → ton projet → Deployments → Logs

### Redéployer Railway:
```bash
cd "/Users/twain/Makto Data"
git add .
git commit -m "Update backend"
git push
```

Railway redéploie automatiquement.

### Redéployer Vercel:
```bash
cd "/Users/twain/Merk/merk-analytics"
git add .
git commit -m "Update frontend"
git push
```

Vercel redéploie automatiquement.

---

## 💰 Coûts

- **Vercel**: $0 (gratuit)
- **Railway**: $5/mois
- **Total**: $5/mois

---

## 🐛 Troubleshooting

### Le worker ne scrape pas:

1. Vérifie les logs Railway
2. Assure-toi que le fichier `proxies` est présent
3. Vérifie que `start-production.js` lance bien le worker

### Le frontend ne charge pas les données:

1. Vérifie la variable `NEXT_PUBLIC_API_URL` dans Vercel
2. Teste l'API directement: `https://ton-backend.railway.app/api/hourly-stats`
3. Regarde la console du navigateur (F12) pour les erreurs CORS

### Base de données vide après déploiement:

C'est normal! La base de données est vide au début. Le worker va commencer à scraper automatiquement. Attends 1 heure pour voir les premières données.

Pour pré-remplir les comptes, tu peux:
1. Utiliser l'API pour ajouter des comptes: `POST /api/accounts`
2. Ou ajouter manuellement via le frontend une fois déployé

---

## 📝 URLs Importantes

Après déploiement, note tes URLs:

- **Backend API**: `https://_______.railway.app`
- **Frontend**: `https://_______.vercel.app`
- **Railway Dashboard**: `https://railway.app/project/_______`
- **Vercel Dashboard**: `https://vercel.com/______/merk-analytics`

---

Prêt à déployer? Suis les étapes dans l'ordre! 🚀
