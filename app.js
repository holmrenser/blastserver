import { PrismaClient } from "@prisma/client";
import { spawnSync } from "child_process";
import { Exception } from "sass";

class TaxonomyFileError extends Exception {}

function initDb() {
  const { stdout, stderr } = spawnSync(
    "npx",
    "prisma migrate dev --name init".split(" ")
  );
  console.log(stdout?.toString("utf8"));
  console.error(stderr?.toString("utf8"));
}

async function insertTaxonmy() {
  const prisma = new PrismaClient();
  const taxonomyCount = await prisma.taxonomy.count();
  if (taxonomyCount) {
    console.log(`FOUND ${taxonomyCount} TAXONOMY ENTRIES`);
  } else {
    const { TAXONOMY_FILE } = process.env;
    if (typeof TAXONOMY_FILE == "undefined") {
      console.error();
      throw TaxonomyFileError(
        "No taxonomy entrues found and TAXONOMY_FILE not specified in env"
      );
    }
    console.log(`NO TAXONOMY ENTRIES FOUND, INSERTING ${TAXONOMY_FILE}`);
    const nInserted = await prisma.$executeRawUnsafe(`
    COPY taxonomy(id, name, ancestors)
    FROM '${TAXONOMY_FILE}'
    DELIMITER E'\t'
    QUOTE E'\b'
    CSV HEADER;
    `);
    console.log(`INSERTED ${nInserted} NAMES`);
  }
  await prisma.$disconnect();
}

async function main() {
  initDb();
  await insertTaxonmy();
  await import("./.next/standalone/server.js");
}

main();
