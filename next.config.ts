import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone' is for Docker only — omit for Vercel
  ...(process.env.NEXT_TEST_DIST_DIR ? { distDir: process.env.NEXT_TEST_DIST_DIR } : {}),
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
