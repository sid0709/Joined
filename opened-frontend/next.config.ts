import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openseat/design-system",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
};

export default nextConfig;
