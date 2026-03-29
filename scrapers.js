const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { StalkUser } = require('@tobyg74/tiktok-api-dl');

puppeteer.use(StealthPlugin());

// Détecter le chemin Chrome selon l'OS
const getChromePath = () => {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    '/usr/bin/google-chrome-stable', // Linux (Railway/Docker)
    '/usr/bin/google-chrome',        // Linux alt
    '/usr/bin/chromium-browser',     // Linux Chromium
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // Puppeteer default
};

// Configuration du navigateur
const getBrowser = async (proxy = null) => {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage'
  ];

  // Ajouter le proxy si fourni
  if (proxy) {
    args.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
  }

  return await puppeteer.launch({
    headless: 'new',
    args
  });
};

// Utilitaire pour attendre et gérer les erreurs
const safeWaitForSelector = async (page, selector, timeout = 10000) => {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    return false;
  }
};

// Scraper TikTok - Utilise l'API @tobyg74/tiktok-api-dl pour récupérer toutes les stats
const scrapeTikTok = async (url, proxy = null) => {
  try {
    // Extraire le username depuis l'URL
    const username = url.split('@')[1]?.split('/')[0]?.split('?')[0];
    if (!username) {
      throw new Error('Username non trouvé dans l\'URL');
    }

    // Préparer les options avec le proxy
    const options = {};
    if (proxy) {
      if (proxy.username && proxy.password) {
        options.proxy = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      } else {
        options.proxy = `http://${proxy.host}:${proxy.port}`;
      }
    }

    // 1. Récupérer les stats du profil avec StalkUser
    const userResult = await StalkUser(username, options);

    if (userResult.status !== 'success' || !userResult.result) {
      throw new Error('Impossible de récupérer le profil TikTok');
    }

    const userStats = userResult.result.stats;

    // 2. Récupérer les vidéos avec GetUserPosts pour avoir les vues
    const postsResult = await GetUserPosts(username, 0, 35, options);

    if (postsResult.status !== 'success' || !postsResult.result) {
      throw new Error('Impossible de récupérer les posts TikTok');
    }

    const videos = postsResult.result || [];

    // Calculer le total de vues
    let totalViews = 0;
    videos.forEach(video => {
      const playCount = video?.stats?.playCount || 0;
      totalViews += playCount;
    });

    return {
      videos: videos.length,
      views: totalViews,
      followers: userStats?.followerCount || 0,
      likes: userStats?.heartCount || 0
    };
  } catch (error) {
    console.error('Erreur TikTok scraping:', error.message);
    throw error;
  }
};

// Scraper TikTok détaillé - Utilise Puppeteer pour capturer les données vidéo via interception API
const scrapeTikTokDetailed = async (url, proxy = null) => {
  const username = url.split('@')[1]?.split('/')[0]?.split('?')[0];
  if (!username) {
    throw new Error('Username non trouvé dans l\'URL');
  }

  let browser;
  try {
    // Lancer Puppeteer sans proxy (le stealth plugin suffit, le proxy cause des 502)
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ];

    console.log(`🌐 TikTok Puppeteer scraping @${username} (direct, stealth mode)`);

    const chromePath = getChromePath();
    browser = await puppeteer.launch({
      headless: 'new',
      args,
      ...(chromePath && { executablePath: chromePath })
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Intercepter les réponses API pour capturer les données vidéo
    const capturedVideos = [];
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (responseUrl.includes('api/post/item_list')) {
        try {
          const json = await response.json();
          if (json.itemList && json.itemList.length > 0) {
            capturedVideos.push(...json.itemList);
          }
        } catch (e) {}
      }
    });

    // Naviguer vers le profil
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Attendre l'hydratation React et le chargement initial des vidéos
    await new Promise(r => setTimeout(r, 5000));

    // Extraire les stats du profil depuis __UNIVERSAL_DATA_FOR_REHYDRATION__
    const profileData = await page.evaluate(() => {
      const script = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (!script) return null;
      try {
        const data = JSON.parse(script.textContent);
        const userInfo = data['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo;
        if (!userInfo) return null;
        return {
          followers: userInfo.stats?.followerCount || 0,
          likes: userInfo.stats?.heartCount || 0,
          videoCount: userInfo.stats?.videoCount || 0
        };
      } catch (e) { return null; }
    });

    if (!profileData) {
      throw new Error('Impossible de récupérer le profil TikTok via Puppeteer');
    }

    const profileStats = {
      followers: profileData.followers,
      likes: profileData.likes
    };

    // Scroller pour charger plus de vidéos (2 scrolls = ~35 vidéos)
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(r => setTimeout(r, 3000));
    }

    await browser.close();
    browser = null;

    // Transformer les vidéos capturées
    const detailedVideos = capturedVideos.map(video => {
      const description = video?.desc || '';
      const hashtags = description.match(/#\w+/g)?.join(' ') || '';
      const videoId = video?.id || '';

      return {
        video_url: videoId ? `https://www.tiktok.com/@${username}/video/${videoId}` : '',
        video_id: videoId,
        views: video?.stats?.playCount || 0,
        likes: video?.stats?.diggCount || 0,
        comments: video?.stats?.commentCount || 0,
        shares: video?.stats?.shareCount || 0,
        saves: video?.stats?.collectCount || 0,
        duration: video?.video?.duration || video?.music?.duration || 0,
        published_date: video?.createTime || null,
        description: description,
        hashtags: hashtags,
        audio_name: video?.music?.title || '',
        audio_url: video?.music?.playUrl || '',
        thumbnail_url: video?.video?.cover || ''
      };
    });

    console.log(`📹 @${username}: ${detailedVideos.length} vidéos capturées via Puppeteer`);

    return {
      profileStats,
      videos: detailedVideos,
      totalVideos: profileData.videoCount || detailedVideos.length
    };
  } catch (error) {
    if (browser) await browser.close().catch(() => {});

    // Fallback: utiliser StalkUser pour les stats profil seulement
    console.log(`⚠️ Puppeteer failed for @${username}: ${error.message}, trying StalkUser fallback...`);
    try {
      const options = {};
      if (proxy) {
        options.proxy = proxy.username && proxy.password
          ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
          : `http://${proxy.host}:${proxy.port}`;
      }

      const userResult = await StalkUser(username, options);
      if (userResult.status === 'success' && userResult.result) {
        const userStats = userResult.result.stats;
        return {
          profileStats: {
            followers: userStats?.followerCount || 0,
            likes: userStats?.heartCount || 0
          },
          videos: [],
          totalVideos: userStats?.videoCount || 0
        };
      }
    } catch (fallbackError) {
      console.error(`❌ StalkUser fallback also failed for @${username}: ${fallbackError.message}`);
    }

    throw error;
  }
};

// Scraper YouTube
const scrapeYouTube = async (url, proxy = null) => {
  const browser = await getBrowser(proxy);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Aller sur la page videos
    const videosUrl = url.includes('/videos') ? url : `${url}/videos`;
    await page.goto(videosUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForTimeout(3000);

    // Scroll pour charger plus de vidéos
    await page.evaluate(() => {
      window.scrollBy(0, 1000);
    });
    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => {
      // Compter les vidéos
      const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');
      const videos = videoElements.length;

      // Récupérer les vues de chaque vidéo
      let totalViews = 0;
      const viewsElements = document.querySelectorAll('#metadata-line span.inline-metadata-item');

      viewsElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.includes('views') || text.includes('vues')) {
          const viewText = text.split(' ')[0].replace(/,/g, '');
          let views = 0;
          if (viewText.includes('K')) {
            views = parseFloat(viewText.replace('K', '')) * 1000;
          } else if (viewText.includes('M')) {
            views = parseFloat(viewText.replace('M', '')) * 1000000;
          } else if (viewText.includes('B')) {
            views = parseFloat(viewText.replace('B', '')) * 1000000000;
          } else {
            views = parseFloat(viewText) || 0;
          }
          totalViews += views;
        }
      });

      return {
        videos: videos,
        views: Math.round(totalViews)
      };
    });

    return stats;
  } catch (error) {
    console.error('Erreur YouTube scraping:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
};

// Scraper Instagram
const scrapeInstagram = async (url, proxy = null) => {
  const browser = await getBrowser(proxy);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForTimeout(3000);

    const stats = await page.evaluate(() => {
      // Récupérer le nombre de posts
      const postsElement = document.querySelector('header section ul li span span');
      const posts = postsElement ? parseInt(postsElement.textContent.replace(/,/g, '')) : 0;

      // Instagram ne montre pas les vues directement sur le profil
      // On va devoir cliquer sur chaque vidéo pour récupérer les vues
      // Pour l'instant, on retourne juste le nombre de posts

      return {
        videos: posts,
        views: 0 // Nécessite connexion et navigation dans chaque post
      };
    });

    return stats;
  } catch (error) {
    console.error('Erreur Instagram scraping:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
};

// Scraper Facebook
const scrapeFacebook = async (url, proxy = null) => {
  const browser = await getBrowser(proxy);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForTimeout(3000);

    const stats = await page.evaluate(() => {
      // Facebook nécessite souvent une connexion
      // Le scraping basique pour compter les posts visibles
      const posts = document.querySelectorAll('[role="article"]').length;

      return {
        videos: posts,
        views: 0 // Nécessite connexion
      };
    });

    return stats;
  } catch (error) {
    console.error('Erreur Facebook scraping:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
};

// Fonction principale de scraping
const scrapeAccount = async (platform, url, proxy = null) => {
  console.log(`Scraping ${platform}: ${url}`);

  switch (platform.toLowerCase()) {
    case 'tiktok':
      return await scrapeTikTok(url, proxy);
    case 'youtube':
      return await scrapeYouTube(url, proxy);
    case 'instagram':
      return await scrapeInstagram(url, proxy);
    case 'facebook':
      return await scrapeFacebook(url, proxy);
    default:
      throw new Error(`Plateforme non supportée: ${platform}`);
  }
};

module.exports = {
  scrapeAccount,
  scrapeTikTok,
  scrapeTikTokDetailed,
  scrapeYouTube,
  scrapeInstagram,
  scrapeFacebook
};
