// middleware.ts - FIXED VERSION TO PREVENT REDIRECT LOOPS
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose"; // Using jose instead of jsonwebtoken for Edge compatibility

// Define public paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
  "/_next",
  "/images",
  "/fonts",
  "/favicon.ico",
];

// All API paths that should be publicly accessible
const publicApiPaths = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/bypass-middleware",
  "/api/debug/auth",
  "/api/debug/auth-fix",
  "/api/debug/auth-status",
  "/api/debug/cookies",
  "/api/debug/diagnostic",
  "/api/debug/direct-login",
  "/api/debug/fix-database",
  "/api/debug/enhance-citations-schema",
  "/api/doi",
  "/api/faculty/check-exists",
  "/api/departments",
  "/api/faculty/autocomplete",
  "/api/admin/fix-user-role", // Temporarily public for fixing user roles
];

// Use env variable with fallback for JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if we're in a redirection loop
  const redirectCount = parseInt(
    request.headers.get("x-redirect-count") || "0"
  );
  if (redirectCount > 2) {
    console.error(`Preventing redirect loop for path: ${pathname}`);
    return NextResponse.next();
  }

  // 1. Special handling for login page - prevent loops between login and dashboard
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    // If we have a valid session token and visiting login, redirect to dashboard
    const sessionToken = request.cookies.get("session_token")?.value;
    const authStatus = request.cookies.get("auth_status")?.value;
    if (
      sessionToken &&
      (authStatus === "logged_in" ||
        authStatus === "debug_login" ||
        authStatus === "direct_login")
    ) {
      try {
        // Verify the token silently using jose instead of jsonwebtoken
        // Create a TextEncoder
        const encoder = new TextEncoder();
        // Convert JWT_SECRET to Uint8Array for jose
        const secretKey = encoder.encode(JWT_SECRET);

        // Verify the token without decoding payload details
        await jose.jwtVerify(sessionToken, secretKey);
        console.log(
          "Valid session detected when visiting login page, redirecting to dashboard"
        );

        // User is already logged in, redirect to dashboard
        const dashboardUrl = new URL("/dashboard", request.url);
        const response = NextResponse.redirect(dashboardUrl);

        // Mark as redirected to track potential loops
        response.headers.set("x-redirect-count", String(redirectCount + 1));
        return response;
      } catch (error) {
        // Invalid token, continue to login page
        console.log(
          "Invalid session token when visiting login, allowing access"
        );
      }
    }

    // Otherwise, allow access to login page
    return NextResponse.next();
  }

  // 2. Check if this is a public path that doesn't need authentication
  for (const path of publicPaths) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return NextResponse.next();
    }
  }

  // 3. Check if this is a public API path
  for (const path of publicApiPaths) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return NextResponse.next();
    }
  }
  // 4. For all other paths, check for session token
  const sessionToken = request.cookies.get("session_token")?.value;
  const authStatus = request.cookies.get("auth_status")?.value;

  // Special handling for direct login
  const isDirectLogin = authStatus === "direct_login";

  // If we have auth_status but no session token, clear the auth_status
  // This fixes cases where cookies are out of sync
  if (!sessionToken && authStatus) {
    const response = NextResponse.next();
    response.cookies.set({
      name: "auth_status",
      value: "",
      maxAge: 0,
      path: "/",
    });

    // Redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    console.log(
      `Auth cookies out of sync, redirecting to: ${loginUrl.toString()}`
    );
    return NextResponse.redirect(loginUrl);
  }

  // If no token and not a public path, redirect to login
  if (!sessionToken) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // For browser routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-redirect-count", String(redirectCount + 1));
    return response;
  }
  // 5. Verify token validity
  try {
    interface JwtPayload {
      userId: number;
      role: string;
      exp?: number;
    }

    // Create a TextEncoder
    const encoder = new TextEncoder();
    // Convert JWT_SECRET to Uint8Array for jose
    const secretKey = encoder.encode(JWT_SECRET);

    // Verify and decode the token using jose
    const { payload } = await jose.jwtVerify(sessionToken, secretKey);

    // Convert Jose payload to our expected format
    const decoded = {
      userId: payload.userId as number,
      role: payload.role as string,
      exp: payload.exp as number | undefined,
    };

    // Token is valid, update it in response
    const response = NextResponse.next();

    // Refresh the auth cookies only if they're about to expire (< 12 hours remaining)
    // This reduces unnecessary cookie writes
    const expiresAt = decoded.exp || Math.floor(Date.now() / 1000) + 86400; // Default to 24 hours if exp is missing
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = expiresAt - now;

    if (timeRemaining < 43200) {
      // Less than 12 hours remaining
      response.cookies.set({
        name: "session_token",
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 1 day
        path: "/",
        sameSite: "lax",
      });

      response.cookies.set({
        name: "auth_status",
        value: "logged_in",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/",
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error(`Invalid token for path: ${pathname}`, error);

    // Invalid token, clear cookies and redirect
    const response = pathname.startsWith("/api/")
      ? NextResponse.json(
          { success: false, message: "Invalid authentication token" },
          { status: 401 }
        )
      : NextResponse.redirect(new URL("/login", request.url));

    // Clear the invalid cookies
    response.cookies.set({
      name: "session_token",
      value: "",
      maxAge: 0,
      path: "/",
    });

    response.cookies.set({
      name: "auth_status",
      value: "",
      maxAge: 0,
      path: "/",
    });

    if (!pathname.startsWith("/api/")) {
      response.headers.set("x-redirect-count", String(redirectCount + 1));
    }

    return response;
  }
}

// Specify which paths this middleware should run on
export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/admin/:path*",
    "/faculty/:path*",
    "/profile/:path*",
    "/student/:path*",
    "/settings/:path*",
    "/departments/:path*",
    "/reports/:path*",
    "/api/:path*",
  ],
};
