/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH,
  env: {
    NEXT_PUBLIC_HAS_USER_INVITE_SECRET: process.env.USER_INVITE_SECRET
      ? "true"
      : "false",
  },
  images: {
    domains: ['images.unsplash.com', 'i.ibb.co', 'scontent.fotp8-1.fna.fbcdn.net'],
    // Make ENV
    unoptimized: true,
  },
  webpack: (config) => ({
    ...config,
    externals: [...(config.externals || []), { canvas: 'canvas' }],
  }),
};

module.exports = nextConfig;
