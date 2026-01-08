import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
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
