import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mailparser", "starkzap", "starknet", "@zk-email/sdk"],
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@solana/web3.js": false,
      "@solana/spl-token": false,
      "@hyperlane-xyz/sdk": false,
      "@hyperlane-xyz/registry": false,
      "@hyperlane-xyz/utils": false,
    };
    return config;
  },
};

export default nextConfig;
