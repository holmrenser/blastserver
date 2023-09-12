/** @type {import('next').NextConfig} */

require("dotenv").config({ path: process.env.ENV_FILE });

// this is only logged during building
const { env } = process;
console.log({ env });

module.exports = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
    instrumentationHook: true,
  },
  basePath: process.env.BASE_PATH,
};
