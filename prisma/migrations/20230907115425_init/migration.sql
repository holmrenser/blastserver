/*
  Warnings:

  - You are about to drop the column `Finished` on the `download` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "download" DROP COLUMN "Finished",
ADD COLUMN     "err" TEXT,
ADD COLUMN     "finished" TIMESTAMP(3),
ADD COLUMN     "log" TEXT;
