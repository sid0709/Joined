import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@joined/design-system",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
};

export default nextConfig;
