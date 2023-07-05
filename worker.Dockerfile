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
RUN npm run build:worker
RUN node ./node_modules/.bin/prisma generate

# final runner
FROM base as runner
ENV NODE_ENV production
#ARG BLAST_VERSION=2.13.0

RUN apt-get update --fix-missing && \
  apt-get install -y ncbi-blast+

#RUN apk add --update --no-cache curl libc6-compat

#RUN mkdir -p /opt/blast && \
#    curl ftp://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/${BLAST_VERSION}/ncbi-blast-${BLAST_VERSION}+-x64-linux.tar.gz \
#      | tar -zxC /opt/blast
#ENV PATH /opt/blast/ncbi-blast-${BLAST_VERSION}+/bin:$PATH

WORKDIR /app
COPY --from=builder /app/worker/worker.mjs ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/.env.production ./.env
COPY --from=builder /app/prisma ./

# RUN npx prisma generate

CMD node ./node_modules/.bin/prisma migrate deploy && node -r dotenv/config worker.mjs