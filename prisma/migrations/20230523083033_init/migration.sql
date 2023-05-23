/*
  Warnings:

  - Added the required column `submitted` to the `blastjob` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "blastjob" ADD COLUMN     "finished" TIMESTAMP(3),
ADD COLUMN     "submitted" TIMESTAMP(3) NOT NULL;
