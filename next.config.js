/** @type {import('next').NextConfig} */

require("dotenv").config({ path: process.env.ENV_FILE });

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
