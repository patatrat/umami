ARG NODE_IMAGE_VERSION="22-alpine"

# Install dependencies only when needed
FROM node:${NODE_IMAGE_VERSION} AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
# pnpm blocks dependencies' install/build scripts by default, which makes a
# frozen-lockfile install exit non-zero even though the packages are fetched
# fine; approve-builds --all runs non-interactively and builds everything
# that was held back (esbuild, sharp, @swc/core, prisma, etc).
RUN (pnpm install --frozen-lockfile || true) && pnpm approve-builds --all

# Rebuild the source code only when needed
FROM node:${NODE_IMAGE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY docker/proxy.ts ./src

ARG BASE_PATH

ENV BASE_PATH=$BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

RUN npm run build-docker

# Production image, copy all the files and run next
FROM node:${NODE_IMAGE_VERSION} AS runner
WORKDIR /app

ARG NODE_OPTIONS

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=$NODE_OPTIONS
# pnpm 11's deps-status check auto-runs "pnpm install" before scripts when it
# suspects node_modules/lockfile drift; that fails with EACCES since the
# container runs as the non-root nextjs user without write access to /app.
ENV pnpm_config_verify_deps_before_run=false

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN set -x \
    && apk add --no-cache curl \
    && npm install -g pnpm

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/generated ./generated

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Script dependencies (npm-run-all, prisma, pg, semver, etc. — needed by
# scripts/check-db.js, update-tracker.js and `prisma migrate deploy`, which
# Next's output trace doesn't fully cover). Installed from the lockfile —
# not via ad-hoc `pnpm add` — so versions exactly match what the builder
# stage resolved/traced; otherwise a re-resolved package (e.g. a newer `pg`)
# can mismatch the version Next.js's standalone trace hard-links via its
# hash-named external symlinks (.next/node_modules/pg-<hash> -> .pnpm/pg@X),
# breaking module resolution at runtime. Run after the standalone copy so
# our complete install isn't clobbered by Next's traced copies, which can be
# incomplete for packages it only partially imports (e.g. semver/index.js).
COPY package.json pnpm-lock.yaml ./
RUN (pnpm install --frozen-lockfile --prod || true) && pnpm approve-builds --all

USER nextjs

EXPOSE 3000

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["pnpm", "start-docker"]