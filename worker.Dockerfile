FROM node:18.16.0-bullseye AS base

ARG BLAST_VERSION=2.14.1

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

RUN wget https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/$BLAST_VERSION/ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz && \
  wget https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/$BLAST_VERSION/ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz.md5 && \
  md5sum -c ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz.md5 && \
  tar xvzf ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz

RUN ls -lah

# final runner
FROM base as runner
ENV NODE_ENV production

WORKDIR /app
COPY --from=builder /app/ncbi-blast-$BLAST_VERSION+/bin/* /usr/bin/
COPY --from=builder /app/worker/build/worker/* ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/.env.production ./.env
COPY --from=builder /app/prisma ./
COPY --from=builder /app/package.json ./

CMD node ./node_modules/.bin/prisma migrate deploy && npm run start:worker