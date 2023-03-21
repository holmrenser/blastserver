-- CreateTable
CREATE TABLE "Blastjob" (
    "id" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "results" XML NOT NULL,

    CONSTRAINT "Blastjob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Blastjob_id_key" ON "Blastjob"("id");
