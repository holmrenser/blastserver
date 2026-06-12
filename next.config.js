// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Server-only packages that must not be bundled: pg-boss + the Prisma 7
  // driver-adapter stack (pg uses dynamic requires/optional native bindings).
  serverExternalPackages: [
    "pg-boss",
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
  ],
  typedRoutes: true,
  // basePath is baked into the client bundle at build time. Supply BASE_PATH
  // (e.g. via a --build-arg) only when serving the app under a sub-path;
  // unset/empty means it is served at the root. Next.js auto-loads .env* files
  // for dev/build, so no manual dotenv bootstrap is needed here.
  basePath: process.env.BASE_PATH || undefined,
  // The generated Prisma 7 client (src/generated/prisma) uses explicit ".js"
  // import specifiers that resolve to ".ts" sources, so webpack must try ".ts"
  // for a ".js" specifier. Turbopack lacks this (extensionAlias parity —
  // vercel/next.js#82945) and its prod build trips a route-handler bug, so both
  // `next dev` and `next build` run with --webpack for this project.
  webpack: (/** @type {any} */ config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ...config.resolve.extensionAlias,
    };
    return config;
  },
};

export default nextConfig;
