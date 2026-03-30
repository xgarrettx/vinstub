import path from 'path';
import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Point file tracing at the monorepo root so standalone output can
  // include shared workspace packages correctly.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async rewrites() {
    return [
      // Proxy all API paths through Next.js so cookies land on localhost:3000
      { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
      { source: '/v1/:path*', destination: `${API_URL}/v1/:path*` },
      { source: '/webhooks/:path*', destination: `${API_URL}/webhooks/:path*` },
    ];
  },
};

export default nextConfig;
