/** @type {import('next').NextConfig} */
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${apiBase}/health`,
      },
    ];
  },
};

export default nextConfig;

