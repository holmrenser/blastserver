FROM node:26.3.0-trixie AS base

# install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# build worker + fetch BLAST+ binaries
FROM base AS builder
# Re-declare inside the stage; an ARG before the first FROM is only in scope for
# FROM lines, and one declared in another stage does not carry over.
ARG BLAST_VERSION=2.17.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ./node_modules/.bin/prisma generate
RUN npm run build:worker

RUN wget https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/$BLAST_VERSION/ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz && \
  wget https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/$BLAST_VERSION/ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz.md5 && \
  md5sum -c ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz.md5 && \
  tar xzf ncbi-blast-$BLAST_VERSION+-x64-linux.tar.gz

# final runner
FROM base AS runner
ARG BLAST_VERSION=2.17.0
ENV NODE_ENV=production

WORKDIR /app
COPY --from=builder /app/ncbi-blast-$BLAST_VERSION+/bin/* /usr/bin/
# Copy the whole build tree (worker/ + the shared src/ it imports at runtime).
COPY --from=builder /app/worker/build ./worker/build
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Worker health server (see worker/health.ts); health probes hit this port.
EXPOSE 8080
# Migrations run as a separate one-shot step (see scripts/migrate-and-seed.ts).
# Compose overrides this to run a single worker process so SIGTERM reaches it.
CMD ["npm", "run", "start:worker"]
