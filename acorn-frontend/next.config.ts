import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@acorn/shared",
    "sid-ui",
    "@joined/google-signin",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
};

export default nextConfig;
