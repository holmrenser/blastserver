/** @type {import('next').NextConfig} */

require("dotenv").config({ path: process.env.ENV_FILE });

module.exports = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
    instrumentationHook: true,
  },
  basePath: process.env.BASE_PATH,
};
