/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'play.google.com',
      },
    ],
  },
  async rewrites() {
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'travelling-the-countries';

    if (!authDomain || authDomain === `${projectId}.firebaseapp.com`) return [];

    return [{
      source: '/__/auth/:path*',
      destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
    }];
  },
};

module.exports = nextConfig;
