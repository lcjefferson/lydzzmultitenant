import type { NextConfig } from "next";
import packageJson from "./package.json";

const buildDate = new Date().toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
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
