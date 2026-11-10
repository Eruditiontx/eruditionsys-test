const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Serve the app under a sub-path (e.g. BASE_PATH=/test). Fixed at build time.
  basePath: process.env.BASE_PATH || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || '',
  },
};

module.exports = withNextIntl(nextConfig);
