FROM node:26.3.0-alpine3.23 AS base

# install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# build app
FROM base AS builder
WORKDIR /app
# basePath is baked into the client bundle at build time; pass it in only when
# the app is served under a sub-path. Defaults to serving at the root.
ARG BASE_PATH=""
ARG NEXT_PUBLIC_BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ./node_modules/.bin/prisma generate
RUN npm run build:app:prod

# final runner
FROM base AS runner
ENV NODE_ENV=production

WORKDIR /app
# All runtime config is injected via the environment (`environment:` in Compose)
# — no .env file is baked into the image.
COPY --from=builder /app/app.js ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public

EXPOSE 3000
# Migrations run as a separate one-shot step (see scripts/migrate-and-seed.ts),
# never on app startup.
CMD ["npm", "run", "start:app"]
