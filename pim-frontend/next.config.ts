import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Only disable during production builds on Vercel
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default nextConfig;
