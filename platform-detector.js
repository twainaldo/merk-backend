// Auto-détection de la plateforme à partir de l'URL

const detectPlatform = (url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('URL invalide');
  }

  const urlLower = url.toLowerCase();

  // TikTok
  if (urlLower.includes('tiktok.com')) {
    return 'TikTok';
  }

  // YouTube
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'YouTube';
  }

  // Instagram
  if (urlLower.includes('instagram.com')) {
    return 'Instagram';
  }

  // Twitter / X
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'Twitter';
  }

  throw new Error(`Plateforme non reconnue pour l'URL: ${url}`);
};

// Extraire le username de l'URL
const extractUsername = (url, platform) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    switch (platform) {
      case 'TikTok':
        // https://www.tiktok.com/@username
        const tiktokMatch = pathname.match(/@([^/]+)/);
        return tiktokMatch ? '@' + tiktokMatch[1] : null;

      case 'YouTube':
        // https://www.youtube.com/@username ou /c/channelname ou /channel/...
        const youtubeMatch = pathname.match(/\/@([^/]+)|\/c\/([^/]+)|\/channel\/([^/]+)/);
        if (youtubeMatch) {
          return '@' + (youtubeMatch[1] || youtubeMatch[2] || youtubeMatch[3]);
        }
        return null;

      case 'Instagram':
        // https://www.instagram.com/username/
        const instaMatch = pathname.match(/\/([^/]+)/);
        return instaMatch && instaMatch[1] !== 'p' ? instaMatch[1] : null;

      case 'Twitter':
        // https://twitter.com/username or https://x.com/username
        const twMatch = pathname.match(/\/([^/]+)/);
        return twMatch && twMatch[1] !== 'search' ? '@' + twMatch[1] : null;

      default:
        return null;
    }
  } catch (error) {
    return null;
  }
};

// Parser une ligne de texte avec URL (supporte différents formats)
const parseAccountLine = (line) => {
  if (!line || typeof line !== 'string') {
    return null;
  }

  line = line.trim();

  if (!line || line.startsWith('#') || line.startsWith('//')) {
    return null; // Ligne vide ou commentaire
  }

  // Extraire l'URL (peut être seule ou dans une ligne avec d'autres textes)
  const urlMatch = line.match(/https?:\/\/[^\s,]+/);
  if (!urlMatch) {
    return null;
  }

  const url = urlMatch[0];

  try {
    const platform = detectPlatform(url);
    let username = extractUsername(url, platform);

    // Si pas de username détecté, essayer de l'extraire de la ligne
    if (!username) {
      const parts = line.split(/[,\t]/);
      if (parts.length > 1) {
        username = parts[0].trim();
      }
    }

    // Fallback: utiliser l'URL comme username
    if (!username) {
      username = url.split('/').filter(p => p).pop();
    }

    return {
      platform,
      username,
      url
    };
  } catch (error) {
    return {
      error: error.message,
      line
    };
  }
};

// Parser un texte avec plusieurs URLs (une par ligne)
const parseBulkAccounts = (text) => {
  if (!text || typeof text !== 'string') {
    return {
      success: [],
      errors: []
    };
  }

  const lines = text.split('\n');
  const results = {
    success: [],
    errors: []
  };

  lines.forEach((line, index) => {
    const parsed = parseAccountLine(line);

    if (!parsed) {
      // Ligne vide ou commentaire, ignorer
      return;
    }

    if (parsed.error) {
      results.errors.push({
        line: index + 1,
        text: parsed.line,
        error: parsed.error
      });
    } else {
      results.success.push(parsed);
    }
  });

  return results;
};

// Exemples de formats supportés
const SUPPORTED_FORMATS = `
Formats supportés:

1. URLs seulement (une par ligne):
   https://www.tiktok.com/@khaby.lame
   https://www.youtube.com/@MrBeast
   https://www.instagram.com/cristiano/

2. Avec username (séparé par virgule ou tab):
   @khaby.lame,https://www.tiktok.com/@khaby.lame
   MrBeast	https://www.youtube.com/@MrBeast

3. Avec commentaires (# ou //):
   # Mes comptes principaux
   https://www.tiktok.com/@khaby.lame
   // Compte secondaire
   https://www.youtube.com/@MrBeast

Plateformes détectées automatiquement:
- TikTok (tiktok.com)
- YouTube (youtube.com, youtu.be)
- Instagram (instagram.com)
- Twitter / X (twitter.com, x.com)
`;

module.exports = {
  detectPlatform,
  extractUsername,
  parseAccountLine,
  parseBulkAccounts,
  SUPPORTED_FORMATS
};
