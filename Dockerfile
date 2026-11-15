# One image for the whole app: the Go server answers the API and serves the
# built frontend from the same origin, so no CORS and one port.
#
#   docker build -t sezzlecalc .
#   docker run --rm -p 8080:8080 sezzlecalc      → http://localhost:8080

# 1. Frontend build. Debian-based rather than Alpine: the TypeScript native
#    compiler ships glibc binaries.
FROM node:26-slim AS web
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2. API build: a static binary with no C dependencies.
FROM golang:1.27-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# 3. Runtime: distroless has no shell or package manager, and runs as a
#    non-root user.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=api /out/server /app/server
COPY --from=web /src/dist /app/public
ENV PORT=8080 \
    STATIC_DIR=/app/public
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
