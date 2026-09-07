import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/repositories") || pathname.startsWith("/import")) && !request.auth) {
    const login = new URL("/", request.nextUrl);
    login.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const development = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com https://github.com https://user-images.githubusercontent.com https://camo.githubusercontent.com",
    "font-src 'self' data:", `connect-src 'self'${development ? " ws: http:" : ""}`, "worker-src 'self' blob:", "manifest-src 'self'",
    ...(development ? [] : ["upgrade-insecure-requests"])
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (!development && request.nextUrl.protocol === "https:") response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
});

export const config = { matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"] };
