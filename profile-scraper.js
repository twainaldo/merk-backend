const axios = require('axios');
const cheerio = require('cheerio');

// Instagram needs Googlebot UA to return og:image
const USER_AGENTS = {
  default: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};

// Normalize URL to ensure https://www. prefix
function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
  url = url.replace('http://', 'https://');
  if (!url.includes('://www.') && !url.includes('://m.')) {
    url = url.replace('://', '://www.');
  }
  return url;
}

/**
 * Scrape profile picture URL from a social media profile page.
 */
async function scrapeProfilePicture(url, platform) {
  const platformLower = (platform || '').toLowerCase();
  const normalizedUrl = normalizeUrl(url);

  // Instagram needs bot UA, others use normal browser UA
  const useBot = platformLower === 'instagram';

  // Twitter/X: use unavatar.io proxy (x.com blocks all scraping)
  if (platformLower === 'twitter') {
    const username = url.match(/(?:twitter|x)\.com\/([^/?]+)/i)?.[1];
    if (username) {
      const avatarUrl = `https://unavatar.io/x/${username}`;
      console.log(`📸 Using unavatar.io for Twitter @${username}`);
      return avatarUrl;
    }
    return null;
  }

  try {
    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': useBot ? USER_AGENTS.bot : USER_AGENTS.default,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);
    let profilePic = null;

    if (platformLower === 'tiktok') {
      const scripts = $('script').toArray();
      for (const s of scripts) {
        const text = $(s).html() || '';
        if (text.includes('avatarLarger') || text.includes('avatarMedium')) {
          const match = text.match(/"avatarLarger":"([^"]+)"/) || text.match(/"avatarMedium":"([^"]+)"/);
          if (match) {
            profilePic = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
            break;
          }
        }
      }
    }

    if (platformLower === 'instagram') {
      profilePic = $('meta[property="og:image"]').attr('content');
    }

    if (platformLower === 'youtube') {
      // Avatar is in the "avatar":{"thumbnails":[...]} JSON — always googleusercontent with no fcrop
      const avatarMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
      if (avatarMatch) {
        profilePic = avatarMatch[1];
      }
    }

    if (platformLower === 'twitter') {
      profilePic = $('meta[property="og:image"]').attr('content');
      if (!profilePic) {
        profilePic = $('meta[name="twitter:image"]').attr('content');
      }
    }

    // Generic fallback
    if (!profilePic) {
      profilePic = $('meta[property="og:image"]').attr('content');
    }
    if (!profilePic) {
      profilePic = $('meta[name="twitter:image"]').attr('content');
    }

    if (profilePic) {
      console.log(`📸 Got profile picture for ${normalizedUrl}`);
      return profilePic;
    }

    console.log(`⚠️ No profile picture found for ${normalizedUrl}`);
    return null;
  } catch (error) {
    console.error(`❌ Failed to scrape profile picture for ${normalizedUrl}:`, error.message);
    return null;
  }
}

module.exports = { scrapeProfilePicture };
