# syntax=docker/dockerfile:1
# Every Next.js app builds from this one file: APP is joined-frontend,
# scoutwell-frontend, admin-frontend, connected-frontend, or joined-theme.
# Build from the repo root:
#   docker build -f docker/next-app.Dockerfile --build-arg APP=joined-frontend .

ARG BUN_VERSION=1.4.2

FROM oven/bun:${BUN_VERSION} AS build
ARG APP
WORKDIR /repo
# Git hooks and telemetry have no place in an image build.
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
# Server-only API URLs are read while building; the real ones come at runtime.
ENV NEXT_OUTPUT=standalone \
    JOINED_API_URL=http://127.0.0.1:8080 \
    SCOUTWELL_API_URL=http://127.0.0.1:8082 \
    ADMIN_API_URL=http://127.0.0.1:8081
RUN bun --filter ${APP} build \
    && cp -r ${APP}/public ${APP}/.next/standalone/${APP}/public \
    && cp -r ${APP}/.next/static ${APP}/.next/standalone/${APP}/.next/static

# Bun runs the standalone server: only the files Next traced, not node_modules.
# The slim Debian image matches the build stage, so native packages match too.
FROM oven/bun:${BUN_VERSION}-slim
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=bun:bun /repo/${APP}/.next/standalone/ ./
WORKDIR /app/${APP}
USER bun
EXPOSE 3000
CMD ["bun", "server.js"]
