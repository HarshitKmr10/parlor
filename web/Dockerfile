# Multi-stage build for the Next.js 16 web app (standalone output).
#
# Stage 1 installs deps + builds. Stage 2 is a minimal runtime carrying only
# the traced standalone server, static assets, and public files.

# ── deps + build ─────────────────────────────────────────────────────────────
FROM node:25-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

# pnpm via corepack (lockfile is v9.0 -> pnpm 10).
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Install dependencies against the frozen lockfile for reproducibility.
# Note: pnpm-workspace.yaml is intentionally NOT copied — this is a single
# package, and pnpm 10 would treat the workspace file as requiring a `packages`
# field. Native post-install builds (sharp/unrs-resolver) are not needed for the
# standalone Next server, so skipping them keeps the build deterministic.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false

# Build. NEXT_PUBLIC_* must be present at build time to be baked into the
# client bundle (browser -> backend base URL).
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN pnpm build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:25-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# Non-root runtime user.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + static assets + public dir.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# server.js is emitted by Next's standalone output.
CMD ["node", "server.js"]
