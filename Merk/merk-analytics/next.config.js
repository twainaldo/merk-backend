/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: 'p16-sign-va.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'p16-sign.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: 'p77-sign.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: '*.akamaized.net',
      },
    ],
  },
};

module.exports = nextConfig;
