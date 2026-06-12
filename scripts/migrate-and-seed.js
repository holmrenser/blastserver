// One-shot bootstrap: apply Prisma migrations, then seed the taxonomy table if
// it is empty. Run by the `migrate` service (Compose) once
// per deploy — never on every app/worker boot, so replicas don't race on the
// schema and the app/worker containers need no write-schema privileges.

import { spawnSync } from "child_process";
import pg from "pg";

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
  // Prisma 7's client is generated TypeScript meant for the app bundle / worker
  // build, so this plain-Node bootstrap talks to Postgres with `pg` directly
  // (a count + a server-side COPY — no models needed).
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT count(*)::int AS count FROM taxonomy"
    );
    const count = rows[0].count;
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
    const result = await client.query(`
    COPY taxonomy(id, name, ancestors)
    FROM '${taxonomyFile}'
    DELIMITER E'\t'
    QUOTE E'\b'
    CSV HEADER;
    `);
    console.log(`Inserted ${result.rowCount} taxonomy rows.`);
  } finally {
    await client.end();
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
