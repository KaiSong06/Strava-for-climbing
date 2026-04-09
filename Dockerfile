# Monorepo-aware Dockerfile for the @crux/api service.
#
# Build context MUST be the repository root so the shared/ directory is
# reachable via the @shared/* path alias declared in api/tsconfig.json.
# tsc-alias rewrites @shared/* to relative paths at build time, so the
# final dist/ has no path-alias runtime dependency.

FROM node:20-alpine

WORKDIR /app

# Install api dependencies first so this layer caches across code changes.
COPY api/package*.json ./api/
WORKDIR /app/api
RUN npm ci

# Copy the api source + the shared types package it depends on at build time.
WORKDIR /app
COPY api ./api
COPY shared ./shared

# Compile TypeScript → dist/. tsc-alias flattens @shared/* into relative paths.
WORKDIR /app/api
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/api/src/index.js"]
