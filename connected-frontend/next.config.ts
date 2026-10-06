import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker images run the standalone server (docker/next-app.Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  transpilePackages: ["sid-ui", "@astryxdesign/core", "@stylexjs/stylex"],
};

export default nextConfig;
