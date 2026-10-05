import type { NextConfig } from "next";
import { ROUTES } from "./lib/nav";

const nextConfig: NextConfig = {
  // Docker images run the standalone server (docker/next-app.Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  transpilePackages: [
    "sid-ui",
    "@astryxdesign/core",
    "@astryxdesign/theme-neutral",
    "@stylexjs/stylex",
  ],
  async redirects() {
    return [
      // Temp jobs moved into Migration, beside the copy and the bulk analysis.
      { source: "/jobs/temp", destination: ROUTES.jobMigration, permanent: true },
      { source: "/migration", destination: ROUTES.jobMigration, permanent: false },
    ];
  },
};

export default nextConfig;
