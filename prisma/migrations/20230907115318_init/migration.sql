-- CreateTable
CREATE TABLE "download" (
    "id" TEXT NOT NULL,
    "sequenceIds" TEXT[],
    "submitted" TIMESTAMP(3) NOT NULL,
    "Finished" TIMESTAMP(3),
    "results" BYTEA,

    CONSTRAINT "download_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "download_id_key" ON "download"("id");
