import type { NextConfig } from 'next';
import path from 'path';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Ensure the standalone bundle includes all monorepo deps and mirrors the
  // directory structure relative to the repo root (apps/web/server.js etc.)
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
      { source: '/v1/:path*', destination: `${API_URL}/v1/:path*` },
      { source: '/webhooks/:path*', destination: `${API_URL}/webhooks/:path*` },
    ];
  },
};

export default nextConfig;
