/** @type {import('next').NextConfig} */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const TAXONOMY_FILE = `${process.cwd()}/taxonomy/taxonomy.tsv`;

const nextConfig = {
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ["bullmq"],
  },
};

module.exports = async function (phase, { defaultConfig }) {
  console.log("STARTUP");
  const taxonomyCount = await prisma.taxonomy.count();
  if (taxonomyCount) {
    console.log(`FOUND ${taxonomyCount} TAXONOMY ENTRIES`);
  } else {
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
  // await prisma.blastjob.findFirst().then(() => prisma.$disconnect());
  return nextConfig;
};
