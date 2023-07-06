FROM node:18.16.0-alpine3.17 AS base

# install dependencies
FROM base as deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# build app
FROM base as builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ./node_modules/.bin/prisma generate
RUN npm run build:app:prod

# final runner
FROM base as runner
ENV NODE_ENV production

WORKDIR /app
COPY --from=builder /app/.env.production ./.env
COPY --from=builder /app/app.js ./
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/prisma ./

CMD node ./node_modules/.bin/prisma migrate deploy && node -r dotenv/config app.js