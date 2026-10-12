import type { NextConfig } from "next";
import { ROUTES } from "./lib/nav";

const nextConfig: NextConfig = {
  // Docker images run the standalone server (docker/next-app.Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    // Dynamic routes are not kept in the client cache unless this is set, so every real click waited on the server.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  transpilePackages: [
    "sid-ui",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
  async redirects() {
    return [
      { source: "/jobs/temp", destination: ROUTES.tempJobs, permanent: true },
      { source: "/migration", destination: ROUTES.tempJobs, permanent: false },
      { source: "/migration/jobs", destination: ROUTES.tempJobs, permanent: false },
      { source: "/migration/companies", destination: ROUTES.tempCompanies, permanent: false },
      { source: "/settings/acorn-ai", destination: ROUTES.aiModel, permanent: true },
      { source: "/settings/deepseek", destination: ROUTES.aiModel, permanent: true },
    ];
  },
};

export default nextConfig;
