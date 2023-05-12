-- CreateTable
CREATE TABLE "blastjob" (
    "id" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "results" XML,
    "log" TEXT,
    "err" TEXT,

    CONSTRAINT "blastjob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ancestors" TEXT NOT NULL,

    CONSTRAINT "taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blastjob_id_key" ON "blastjob"("id");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_id_key" ON "taxonomy"("id");
