import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Adds CORS headers to API responses, but only for origins explicitly listed in
 * the CORS_ALLOW_ORIGIN env var (comma-separated). Same-origin requests from the
 * app itself need no CORS headers, so the default is to allow none rather than
 * the previous wildcard "*".
 *
 * Next 16 renamed the `middleware` convention to `proxy` (nodejs runtime only).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) {
    return response;
  }

  const allowedOrigins = (process.env.CORS_ALLOW_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request.headers.get("origin");

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,DELETE,PATCH,POST,PUT"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
    );
  }

  return response;
}
