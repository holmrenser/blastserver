import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Captures all api requests and inserts CORS headers
 * @param request any incomming html request
 * @returns modified response with CORS headers injected for api requests
 */
export async function middleware(request: NextRequest) {
    const response = NextResponse.next()
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/api")) {
        response.headers.append("Access-Control-Allow-Origin", "*")
        response.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT')
        response.headers.append(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
        )
    }
    return response
}