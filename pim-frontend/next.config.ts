import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Only disable during production builds on Vercel
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
