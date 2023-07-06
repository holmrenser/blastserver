/** @type {import('next').NextConfig} */

require("dotenv").config({ path: process.env.ENV_FILE });

module.exports = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq"],
    instrumentationHook: true,
  },
  basePath: process.env.BASE_PATH,
  /* async headers() {
    // used to enable CORS requests
    return [
      {
        // matching all API routes
        source: `${process.env.BASE_PATH}/api/:path*`,
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" }, // replace this your actual origin
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },*/
};
