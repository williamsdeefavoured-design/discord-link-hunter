/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
  // /api/* and /health are handled by server-only route handlers.
  // Never expose a shared API secret through a browser-facing rewrite.
};

export default nextConfig;
