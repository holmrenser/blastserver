-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "blastjob" (
    "id" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "submitted" TIMESTAMP(3) NOT NULL,
    "finished" TIMESTAMP(3),
    "results" XML,
    "log" TEXT,
    "err" TEXT,

    CONSTRAINT "blastjob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ancestors" TEXT[],

    CONSTRAINT "taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download" (
    "id" TEXT NOT NULL,
    "sequenceIds" TEXT[],
    "submitted" TIMESTAMP(3) NOT NULL,
    "finished" TIMESTAMP(3),
    "results" BYTEA,
    "log" TEXT,
    "err" TEXT,

    CONSTRAINT "download_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blastjob_id_key" ON "blastjob"("id");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_id_key" ON "taxonomy"("id");

-- CreateIndex
CREATE UNIQUE INDEX "download_id_key" ON "download"("id");

