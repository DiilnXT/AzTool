import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    cpus: 2,
  },
  allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000', '192.168.1.*'],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
