import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker images run the standalone server (docker/next-app.Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    // Dynamic routes are not kept in the client cache unless this is set, so every click waited on the server.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    optimizePackageImports: ["sid-ui"],
  },
  transpilePackages: [
    "sid-ui",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
};

export default nextConfig;
