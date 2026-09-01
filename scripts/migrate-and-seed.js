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

async function seedClusterMetadata() {
  // clustered_nr cluster metadata (member lists + per-cluster LCA). Optional: skip
  // with a warning when the files aren't configured, so deploys that don't use
  // clustered_nr aren't forced to provide them. Idempotent on cluster_lca row count.
  const lcaFile = process.env.CLUSTER_LCA_FILE;
  const membersFile = process.env.CLUSTER_MEMBERS_FILE;
  if (!lcaFile || !membersFile) {
    console.log(
      "CLUSTER_LCA_FILE / CLUSTER_MEMBERS_FILE not set; skipping cluster seed " +
        "(clustered_nr searches won't be enriched until these are provided)."
    );
    return;
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT count(*)::int AS count FROM cluster_lca"
    );
    if (rows[0].count > 0) {
      console.log(
        `Cluster metadata already seeded (${rows[0].count} LCA rows); skipping.`
      );
      return;
    }

    // LCA: representative -> cluster LCA taxid. Stage as text so the empty
    // `coalesce(taxid,'')` cells become NULL rather than failing the int COPY.
    console.log(`Seeding cluster LCAs from ${lcaFile} ...`);
    await client.query("BEGIN");
    await client.query(
      "CREATE TEMP TABLE _lca_stage (representative text, lca_taxid text) ON COMMIT DROP"
    );
    await client.query(
      `COPY _lca_stage FROM '${lcaFile}' DELIMITER E'\t' QUOTE E'\b' CSV HEADER`
    );
    const lcaRes = await client.query(
      `INSERT INTO cluster_lca (representative, "lcaTaxid")
       SELECT representative, NULLIF(lca_taxid, '')::int FROM _lca_stage`
    );
    await client.query("COMMIT");
    console.log(`Inserted ${lcaRes.rowCount} cluster_lca rows.`);

    // Members: one row per (representative, member). Representatives are stored
    // verbatim (saccver form) — never normalized.
    console.log(`Seeding cluster members from ${membersFile} ...`);
    await client.query("BEGIN");
    await client.query(
      `CREATE TEMP TABLE _member_stage
         (representative text, accession text, taxid text, title text)
       ON COMMIT DROP`
    );
    await client.query(
      `COPY _member_stage FROM '${membersFile}' DELIMITER E'\t' QUOTE E'\b' CSV HEADER`
    );
    const memberRes = await client.query(
      // Empty member titles arrive as NULL from the CSV COPY; the column is NOT
      // NULL, so coalesce them to '' (taxids stay nullable).
      `INSERT INTO cluster_member (representative, accession, taxid, title)
       SELECT representative, accession, NULLIF(taxid, '')::int, COALESCE(title, '')
       FROM _member_stage`
    );
    await client.query("COMMIT");
    console.log(`Inserted ${memberRes.rowCount} cluster_member rows.`);
  } finally {
    await client.end();
  }
}

async function main() {
  runMigrations();
  await seedTaxonomy();
  await seedClusterMetadata();
  console.log("Migrate + seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
