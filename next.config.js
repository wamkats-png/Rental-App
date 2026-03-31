/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/**', '**/node_modules/**'],
    };
    // pdfjs-dist requires canvas to be aliased away in browser builds
    config.resolve.alias.canvas = false;
    return config;
  },
}

module.exports = nextConfig
