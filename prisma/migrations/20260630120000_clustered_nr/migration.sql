-- clustered_nr cluster metadata: member lists + per-cluster LCA, keyed by the
-- representative accession (saccver form, stored verbatim). Seeded by
-- scripts/migrate-and-seed.js from NCBI's cluster sqlite export.

-- CreateTable
CREATE TABLE "cluster_lca" (
    "representative" TEXT NOT NULL,
    "lcaTaxid" INTEGER,

    CONSTRAINT "cluster_lca_pkey" PRIMARY KEY ("representative")
);

-- CreateTable
CREATE TABLE "cluster_member" (
    "id" SERIAL NOT NULL,
    "representative" TEXT NOT NULL,
    "accession" TEXT NOT NULL,
    "taxid" INTEGER,
    "title" TEXT NOT NULL,

    CONSTRAINT "cluster_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cluster_member_representative_idx" ON "cluster_member"("representative");

-- CreateIndex
CREATE INDEX "cluster_member_accession_idx" ON "cluster_member"("accession");
