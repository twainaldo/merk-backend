# Merk Analytics

Site d'analytics pour tracker les stats de TikTok, Instagram, YouTube et Facebook.

## 🚨 Prérequis Important

**Node.js >= 20.9.0 est requis** pour Next.js 16.

Vous utilisez actuellement Node.js v18.16.1. Vous avez deux options :

### Option 1 : Mettre à jour Node.js (Recommandé)

```bash
# Avec nvm
nvm install 20
nvm use 20

# Ou télécharger depuis nodejs.org
# https://nodejs.org/
```

### Option 2 : Downgrader Next.js

```bash
cd merk-analytics
npm install next@14.2.18 --save
```

## 🚀 Démarrage

```bash
cd merk-analytics
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📁 Structure du Projet

```
merk-analytics/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── dashboard/
│   │   └── page.tsx            # Dashboard avec analytics
│   ├── layout.tsx              # Layout global
│   └── globals.css             # Styles globaux
├── lib/
│   └── utils.ts                # Utilitaires (cn, etc.)
├── components/
│   └── ui/                     # Composants shadcn/ui
└── public/
    └── merk.png                # Logo
```

## 🎨 Pages Disponibles

- `/` - Landing page avec CTA vers le dashboard
- `/dashboard` - Dashboard avec analytics (données mockées)

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Charts:** Recharts
- **Language:** TypeScript

## 📊 Features Actuelles (MVP)

### Landing Page
- Header avec navigation
- Hero section avec icônes sociales (Instagram, TikTok, YouTube, Facebook)
- CTA "Start Tracking"

### Dashboard
- Sidebar avec navigation
- Filtres par collection, compte, plateforme
- Sélecteur de date range
- 6 métriques principales:
  - Views (31.5K)
  - Engagement (1.9K)
  - Likes (1.7K)
  - Comments (5)
  - Shares (38)
  - Saves (84)
- Graphique de visualisation (LineChart)
- Section "Most Viral Videos" avec mock data

## 🔄 Prochaines Étapes

### Phase 1 : MVP avec données mockées ✅
- [x] Landing page
- [x] Dashboard UI complet
- [x] Mock data pour les graphiques

### Phase 2 : Intégration APIs (À venir)
- [ ] YouTube Data API
- [ ] Instagram Graph API
- [ ] TikTok scraping/API
- [ ] Facebook Graph API

### Phase 3 : Features Avancées
- [ ] Auth avec Supabase
- [ ] Database pour stocker les données
- [ ] Export CSV/PDF
- [ ] Alertes/Notifications
- [ ] Comparaison de périodes
- [ ] Filtres avancés

## 💡 APIs Prévues

### Budget 0$ (MVP)
- **YouTube:** API officielle gratuite (10K quotas/jour)
- **TikTok:** Scraping public data
- **Instagram:** Scraping léger ou embed API
- **Facebook:** Graph API

### Plus tard (Si budget)
- Phyllo
- SocialKit
- Data365
- Ensembledata

## 🎯 Objectif

Créer un dashboard unifié type Shortimize/Exolyt pour tracker les performances de contenus short-form sur toutes les plateformes.

## 📝 Notes

- Les données actuelles sont mockées
- UI inspirée de Shortimize
- Thème blanc/clean
- Focus sur les métriques virales
