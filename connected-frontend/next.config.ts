import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@joined/design-system", "@astryxdesign/core", "@stylexjs/stylex"],
};

export default nextConfig;
