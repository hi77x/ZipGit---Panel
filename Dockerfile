FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:26-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG AUTH_SECRET=build-time-placeholder-secret-0123456789
ARG AUTH_GITHUB_ID=build-client-id
ARG AUTH_GITHUB_SECRET=build-client-secret
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV AUTH_SECRET=$AUTH_SECRET AUTH_GITHUB_ID=$AUTH_GITHUB_ID AUTH_GITHUB_SECRET=$AUTH_GITHUB_SECRET NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ARG REPODECK_VERSION=dev
ARG REPODECK_COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="RepoDeck" \
      org.opencontainers.image.description="Self-hosted command deck for GitHub" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/hi77x/ZipGit---Panel" \
      org.opencontainers.image.version="$REPODECK_VERSION" \
      org.opencontainers.image.revision="$REPODECK_COMMIT_SHA"
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    REPODECK_VERSION=$REPODECK_VERSION REPODECK_COMMIT_SHA=$REPODECK_COMMIT_SHA
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
