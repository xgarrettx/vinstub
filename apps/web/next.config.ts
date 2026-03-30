import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
      { source: '/v1/:path*', destination: `${API_URL}/v1/:path*` },
      { source: '/webhooks/:path*', destination: `${API_URL}/webhooks/:path*` },
    ];
  },
};

export default nextConfig;
