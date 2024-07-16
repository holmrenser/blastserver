// @ts-check

require("dotenv").config({ path: process.env.ENV_FILE });

// this is only logged during building
const { env } = process;
console.log({ env });

/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
    typedRoutes: true,
  },
  basePath: process.env.BASE_PATH,
};
