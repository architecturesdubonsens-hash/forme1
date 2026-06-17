/** @type {import('next').NextConfig} */
const BACKEND = 'https://modelinsitu-backend-production-95b3.up.railway.app';

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${BACKEND}/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};
module.exports = nextConfig;
