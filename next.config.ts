import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
  outputFileTracingExcludes: {
    "*": [
      "./release/**",
      "./standalone-build/**",
      "./dist/**",
      "./dist-electron/**",
      "./electron/**",
      "./docs/**",
      "./scripts/**",
      "./data/**",
      "./team_data/**",
      "./.worktrees/**",
    ],
  },
};

export default nextConfig;
