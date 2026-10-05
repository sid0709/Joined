import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@acorn/shared",
    "@joined/design-system",
    "@joined/google-signin",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
};

export default nextConfig;
