// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg-boss"],
  typedRoutes: true,
  // basePath is baked into the client bundle at build time. Supply BASE_PATH
  // (e.g. via a --build-arg) only when serving the app under a sub-path;
  // unset/empty means it is served at the root. Next.js auto-loads .env* files
  // for dev/build, so no manual dotenv bootstrap is needed here.
  basePath: process.env.BASE_PATH || undefined,
};

export default nextConfig;
