// One-shot bootstrap: apply Prisma migrations, then seed the taxonomy table if
// it is empty. Run by the `migrate` service (Compose) once
// per deploy — never on every app/worker boot, so replicas don't race on the
// schema and the app/worker containers need no write-schema privileges.

import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

function runMigrations() {
  console.log("Applying database migrations (prisma migrate deploy)...");
  const result = spawnSync(
    "node",
    ["./node_modules/.bin/prisma", "migrate", "deploy"],
    { stdio: "inherit" }
  );
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed (exit code ${result.status})`);
  }
}

async function seedTaxonomy() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.taxonomy.count();
    if (count > 0) {
      console.log(`Taxonomy already seeded (${count} entries); skipping.`);
      return;
    }
    const taxonomyFile = process.env.TAXONOMY_FILE;
    if (!taxonomyFile) {
      throw new Error(
        "Taxonomy table is empty and TAXONOMY_FILE is not set in the environment"
      );
    }
    console.log(`Seeding taxonomy from ${taxonomyFile} ...`);
    // COPY runs server-side, so this path must exist on the Postgres host
    // (mounted into the Postgres container in Compose).
    const inserted = await prisma.$executeRawUnsafe(`
    COPY taxonomy(id, name, ancestors)
    FROM '${taxonomyFile}'
    DELIMITER E'\t'
    QUOTE E'\b'
    CSV HEADER;
    `);
    console.log(`Inserted ${inserted} taxonomy rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  runMigrations();
  await seedTaxonomy();
  console.log("Migrate + seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
