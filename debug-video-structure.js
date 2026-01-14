const { GetUserPosts } = require('@tobyg74/tiktok-api-dl');

const debugVideoStructure = async () => {
  console.log('🔍 Debugging video structure...\n');

  const username = 'dance.culture0';
  const result = await GetUserPosts(username, 0, 3);

  if (result.status === 'success' && result.result) {
    console.log('✅ Got videos, showing first video structure:\n');
    const firstVideo = result.result[0];
    console.log(JSON.stringify(firstVideo, null, 2));
  }
};

debugVideoStructure();
