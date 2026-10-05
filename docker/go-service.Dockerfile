# syntax=docker/dockerfile:1
# Every Go API builds from this one file: SERVICE is joined-backend,
# admin-backend, scoutwell-backend, or acorn-backend. Build from the repo root:
#   docker build -f docker/go-service.Dockerfile --build-arg SERVICE=joined-backend .

ARG GO_VERSION=1.26.4

FROM golang:${GO_VERSION} AS build
ARG SERVICE
WORKDIR /src
# Each service's go.mod points at ../backend-core, so the build needs no go.work.
ENV GOWORK=off CGO_ENABLED=0 GOOS=linux
COPY backend-core/go.mod backend-core/go.sum backend-core/
COPY ${SERVICE}/go.mod ${SERVICE}/go.sum ${SERVICE}/
RUN --mount=type=cache,target=/go/pkg/mod cd ${SERVICE} && go mod download
COPY backend-core/ backend-core/
COPY ${SERVICE}/ ${SERVICE}/
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    cd ${SERVICE} && go build -trimpath -ldflags="-s -w" -o /out/ ./cmd/...

# Static binaries need no OS: distroless has CA certificates and time zones, and no shell.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/ /app/
# Inside the container every API listens on 8080; Compose maps it to a host port.
ENV HTTP_ADDR=0.0.0.0:8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
