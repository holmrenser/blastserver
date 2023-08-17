/*
  Warnings:

  - The `ancestors` column on the `taxonomy` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "taxonomy" DROP COLUMN "ancestors",
ADD COLUMN     "ancestors" TEXT[];
