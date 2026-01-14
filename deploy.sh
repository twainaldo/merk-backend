#!/bin/bash

echo "🚀 Merk Analytics - Script de Déploiement Automatique"
echo ""
echo "Ce script va:"
echo "1. Installer GitHub CLI (gh) si nécessaire"
echo "2. Créer 2 repos GitHub privés"
echo "3. Push le backend et frontend"
echo "4. Te guider pour Railway et Vercel"
echo ""
read -p "Prêt? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

echo ""
echo "📦 Étape 1: Installation de GitHub CLI..."
echo ""

# Vérifier si gh est déjà installé
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI déjà installé!"
else
    echo "Installation de GitHub CLI..."

    # Détection de l'OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - essayer d'installer avec curl
        if ! command -v brew &> /dev/null; then
            echo "⚠️  Homebrew n'est pas installé."
            echo ""
            echo "Pour continuer automatiquement, installe Homebrew:"
            echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo ""
            echo "Ou continue manuellement en visitant: https://github.com/cli/cli#installation"
            exit 1
        fi

        brew install gh
    else
        echo "⚠️  Installation automatique non supportée sur cet OS."
        echo "Visite https://github.com/cli/cli#installation pour installer gh"
        exit 1
    fi
fi

echo ""
echo "🔐 Étape 2: Connexion à GitHub..."
echo ""

# Vérifier si déjà connecté
if gh auth status &> /dev/null; then
    echo "✅ Déjà connecté à GitHub!"
else
    echo "Connexion à GitHub..."
    gh auth login
fi

echo ""
echo "📁 Étape 3: Création des repos GitHub..."
echo ""

# Backend repo
echo "Création du repo backend..."
cd "/Users/twain/Makto Data"

BACKEND_REPO=$(gh repo create merk-backend --private --source=. --push 2>&1)
if [[ $? -eq 0 ]]; then
    echo "✅ Backend repo créé et pushé!"
else
    echo "ℹ️  Le repo existe peut-être déjà. Tentative de push..."
    git remote add origin "https://github.com/$(gh api user -q .login)/merk-backend.git" 2>/dev/null || true
    git push -u origin main
fi

# Frontend repo
echo ""
echo "Création du repo frontend..."
cd "/Users/twain/Merk/merk-analytics"

FRONTEND_REPO=$(gh repo create merk-analytics --private --source=. --push 2>&1)
if [[ $? -eq 0 ]]; then
    echo "✅ Frontend repo créé et pushé!"
else
    echo "ℹ️  Le repo existe peut-être déjà. Tentative de push..."
    git remote add origin "https://github.com/$(gh api user -q .login)/merk-analytics.git" 2>/dev/null || true
    git push -u origin main
fi

echo ""
echo "✅ ✅ ✅  Repos créés et code pushé!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Prochaines Étapes:"
echo ""
echo "1️⃣  RAILWAY (Backend + Worker):"
echo "   • Va sur https://railway.app"
echo "   • New Project → Deploy from GitHub repo"
echo "   • Choisis 'merk-backend'"
echo "   • Ajoute la variable: PORT=3000"
echo "   • Deploy et note ton URL!"
echo ""
echo "2️⃣  VERCEL (Frontend):"
echo "   • Va sur https://vercel.com"
echo "   • New Project → Choisis 'merk-analytics'"
echo "   • Ajoute la variable:"
echo "     NEXT_PUBLIC_API_URL=https://TON-URL-RAILWAY.up.railway.app"
echo "   • Deploy!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Guide complet: /Users/twain/Makto Data/DEPLOYMENT-GUIDE.md"
echo ""
