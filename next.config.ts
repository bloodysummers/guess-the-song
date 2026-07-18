import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project so Next doesn't pick up a parent lockfile.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
