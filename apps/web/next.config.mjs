/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /api/* and /health are handled by server-only route handlers.
  // Never expose a shared API secret through a browser-facing rewrite.
};

export default nextConfig;
