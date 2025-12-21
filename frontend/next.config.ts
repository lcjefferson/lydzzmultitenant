import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: 'http://backend:3000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
