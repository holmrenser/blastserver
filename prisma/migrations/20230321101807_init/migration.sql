/*
  Warnings:

  - You are about to drop the `Blastjob` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Blastjob";

-- CreateTable
CREATE TABLE "blastjob" (
    "id" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "results" XML NOT NULL,

    CONSTRAINT "blastjob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blastjob_id_key" ON "blastjob"("id");
