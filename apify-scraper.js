const { ApifyClient } = require('apify-client');

// Actor config per platform
const ACTOR_CONFIG = {
  tiktok: {
    actorId: 'clockworks/tiktok-scraper',
    buildInput: (account, maxResults) => ({
      profiles: [account.username.replace(/^@/, '')],
      resultsPerPage: maxResults || 100000,
      proxyCountryCode: 'None',
    }),
    mapItem: (item, account) => ({
      account_id: account.id,
      video_url: item.webVideoUrl || item.videoUrl || item.url || '',
      video_id: item.id || item.videoId || '',
      views: item.playCount || item.plays || item.viewCount || 0,
      likes: item.diggCount || item.likes || item.likesCount || 0,
      comments: item.commentCount || item.comments || item.commentsCount || 0,
      shares: item.shareCount || item.shares || item.sharesCount || 0,
      saves: item.collectCount || item.saves || item.bookmarks || 0,
      duration: item.videoMeta?.duration || item.duration || 0,
      published_date: item.createTime || item.createTimeISO || item.uploadDate || null,
      description: item.text || item.description || '',
      hashtags: (item.hashtags || []).map(h => typeof h === 'string' ? `#${h}` : `#${h.name || h}`).join(' '),
      thumbnail_url: item.videoMeta?.coverUrl || item.coverUrl || item.thumbnailUrl || '',
      audio_name: item.musicMeta?.musicName || item.audioName || '',
      audio_url: item.musicMeta?.playUrl || item.audioUrl || '',
    }),
  },
  instagram: {
    actorId: 'apify/instagram-scraper',
    buildInput: (account, maxResults) => ({
      directUrls: [`https://www.instagram.com/${account.username.replace(/^@/, '')}/`],
      resultsLimit: maxResults || 100000,
      resultsType: 'posts',
    }),
    mapItem: (item, account) => ({
      account_id: account.id,
      video_url: item.url || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : ''),
      video_id: item.id || item.shortCode || '',
      views: item.videoViewCount || item.viewCount || item.playCount || 0,
      likes: item.likesCount || item.likes || 0,
      comments: item.commentsCount || item.comments || 0,
      shares: 0,
      saves: 0,
      duration: item.videoDuration || item.duration || 0,
      published_date: item.timestamp || item.takenAtTimestamp || null,
      description: item.caption || item.alt || '',
      hashtags: (item.hashtags || []).map(h => `#${h}`).join(' '),
      thumbnail_url: item.displayUrl || item.thumbnailUrl || '',
      audio_name: '',
      audio_url: '',
    }),
  },
  youtube: {
    actorId: 'streamers/youtube-scraper',
    buildInput: (account, maxResults) => {
      // Actor expects {url: "..."} objects in startUrls, not bare strings
      const url = account.url || `https://www.youtube.com/@${account.username.replace(/^@/, '')}`;
      return {
        startUrls: [{ url }],
        maxResults: maxResults || 100000,
        maxResultsShorts: maxResults || 100000,
        maxResultStreams: 0,
      };
    },
    mapItem: (item, account) => ({
      account_id: account.id,
      video_url: item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : ''),
      video_id: item.id || item.videoId || '',
      views: item.viewCount || item.views || 0,
      likes: item.likes || item.likesCount || 0,
      comments: item.commentsCount || item.comments || 0,
      shares: 0,
      saves: 0,
      duration: item.duration || 0,
      published_date: item.date || item.uploadDate || item.publishedAt || null,
      description: item.title || item.description || '',
      hashtags: '',
      thumbnail_url: item.thumbnailUrl || item.thumbnail || '',
      audio_name: '',
      audio_url: '',
    }),
  },
  twitter: {
    actorId: 'apidojo/tweet-scraper',
    buildInput: (account, maxResults) => ({
      twitterHandles: [account.username.replace(/^@/, '')],
      maxItems: maxResults || 100000,
      sort: 'Latest',
    }),
    mapItem: (item, account) => ({
      account_id: account.id,
      video_url: item.url || item.tweetUrl || '',
      video_id: item.id || item.tweetId || '',
      views: item.viewCount || item.views || 0,
      likes: item.likeCount || item.likes || item.favoriteCount || 0,
      comments: item.replyCount || item.replies || 0,
      shares: item.retweetCount || item.retweets || 0,
      saves: item.bookmarkCount || item.bookmarks || 0,
      duration: 0,
      published_date: item.createdAt || item.timestamp || null,
      description: item.text || item.fullText || '',
      hashtags: (item.hashtags || []).map(h => `#${h}`).join(' '),
      thumbnail_url: item.mediaUrl || item.media?.[0]?.url || '',
      audio_name: '',
      audio_url: '',
    }),
  },
};

// Round-robin key index
let keyIndex = 0;

function getNextApiKey(keys) {
  if (!keys || keys.length === 0) {
    throw new Error('No Apify API keys configured. Add keys in Settings.');
  }
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

// Generate date ranges: 2-month chunks from now back to 2025-01-01
function getDateRanges() {
  const ranges = [];
  const end = new Date();
  const cutoff = new Date('2025-01-01');

  let rangeEnd = new Date(end);
  while (rangeEnd > cutoff) {
    let rangeStart = new Date(rangeEnd);
    rangeStart.setMonth(rangeStart.getMonth() - 2);
    if (rangeStart < cutoff) rangeStart = new Date(cutoff);

    ranges.push({
      start: rangeStart.toISOString().split('T')[0],
      end: rangeEnd.toISOString().split('T')[0],
    });

    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() - 1);
  }
  return ranges;
}

// Single fetch call for one date range (or no range for non-TikTok)
async function fetchOneRun(client, config, account, platform, dateRange) {
  const input = config.buildInput(account);

  // TikTok supports date range filtering
  if (platform === 'tiktok' && dateRange) {
    input.oldestPostDate = dateRange.start;
    input.newestPostDate = dateRange.end;
  }

  const run = await client.actor(config.actorId).call(input, {
    waitSecs: 600,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}

// Fetch videos for a single account
// For TikTok: fetches in 2-month chunks to bypass pagination limits
// apiKeys = array of all available keys, rotates on error
// onLog callback for live progress
async function fetchVideosForAccount(apiKeys, platform, account, maxResults, onLog) {
  // Support both single key (string) and array of keys
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  let currentKeyIndex = 0;

  const config = ACTOR_CONFIG[platform.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const log = onLog || console.log;

  // Try a run with current key, rotate on billing/quota error
  async function tryRun(config, account, platformLower, dateRange) {
    let lastError = null;
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[currentKeyIndex % keys.length];
      const client = new ApifyClient({ token: key });
      try {
        const items = await fetchOneRun(client, config, account, platformLower, dateRange);
        return items;
      } catch (e) {
        lastError = e;
        if (e.message && (e.message.includes('usage') || e.message.includes('billing') || e.message.includes('exceed') || e.message.includes('limit') || e.message.includes('subscription'))) {
          log(`⚠️ Key ...${key.slice(-4)} exhausted, switching to next key...`);
          currentKeyIndex++;
          continue;
        }
        throw e; // Non-billing error, don't retry
      }
    }
    throw lastError || new Error('All API keys exhausted');
  }

  let allItems = [];

  if (platform.toLowerCase() === 'tiktok') {
    // Fetch in 2-month chunks
    const ranges = getDateRanges();
    log(`📅 Splitting into ${ranges.length} date ranges for @${account.username}`);

    for (let r = 0; r < ranges.length; r++) {
      const range = ranges[r];
      log(`📅 [${r + 1}/${ranges.length}] ${range.start} → ${range.end} — fetching...`);

      try {
        const items = await tryRun(config, account, platform.toLowerCase(), range);
        log(`📅 [${r + 1}/${ranges.length}] ${range.start} → ${range.end} — ${items.length} videos found`);
        allItems = allItems.concat(items);
      } catch (e) {
        log(`📅 [${r + 1}/${ranges.length}] ${range.start} → ${range.end} — ERROR: ${e.message}`);
      }
    }
  } else {
    // Other platforms: single fetch
    const key = keys[currentKeyIndex % keys.length];
    log(`🎬 Fetching videos for @${account.username} on ${platform} (key: ...${key.slice(-4)})`);
    try {
      allItems = await tryRun(config, account, platform.toLowerCase());
    } catch (e) {
      log(`❌ @${account.username} — ERROR: ${e.message}`);
    }
  }

  console.log(`✅ Got ${allItems.length} total items for @${account.username}`);

  // Map and filter valid items (only videos from 2025-01-01+)
  const cutoffDate = new Date('2025-01-01').getTime();
  const videos = allItems
    .map(item => {
      try {
        return config.mapItem(item, account);
      } catch (e) {
        console.warn(`⚠️ Failed to map item:`, e.message);
        return null;
      }
    })
    .filter(v => {
      if (!v || !v.video_url) return false;
      if (v.published_date) {
        const pubDate = typeof v.published_date === 'number'
          ? new Date(v.published_date * 1000).getTime()
          : new Date(v.published_date).getTime();
        if (!isNaN(pubDate) && pubDate < cutoffDate) return false;
      }
      return true;
    });

  // Deduplicate by video_url
  const seen = new Set();
  const unique = videos.filter(v => {
    if (seen.has(v.video_url)) return false;
    seen.add(v.video_url);
    return true;
  });

  return unique;
}

// Fetch stats (re-runs actor and updates metrics only)
async function fetchStatsForVideos(apiKeys, platform, account, maxResults, onLog) {
  return fetchVideosForAccount(apiKeys, platform, account, maxResults, onLog);
}

module.exports = {
  ACTOR_CONFIG,
  getNextApiKey,
  fetchVideosForAccount,
  fetchStatsForVideos,
};
