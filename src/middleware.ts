import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    // retrieve the current response
    console.log('MIDDLEWARE')
    const response = NextResponse.next()

    if (request.nextUrl.pathname.startsWith("/api")) {
        response.headers.append("Access-Control-Allow-Origin", "*")
        response.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT')
        response.headers.append(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
        )
    }
    return response
}