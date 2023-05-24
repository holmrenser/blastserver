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
RUN npm run build:app


# final runner
FROM base as runner
ENV NODE_ENV production

WORKDIR /app
COPY --from=builder /app/app.js ./
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

CMD node app.js