FROM node:18.16.0-bullseye AS base

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
RUN npm run build:worker


# final runner
FROM base as runner
ENV NODE_ENV production

RUN apt-get update --fix-missing && \
  apt-get install -y ncbi-blast+

WORKDIR /app
COPY --from=builder /app/worker/worker.mjs ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/.env.production ./.env
COPY --from=builder /app/prisma ./

CMD node ./node_modules/.bin/prisma migrate deploy && node -r dotenv/config worker.mjs