import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: real authorization happens in requireRole() on the server.
const PROTECTED = ["/dashboard", "/plans", "/courses", "/pathways", "/import", "/appeals", "/review", "/counselor", "/admin", "/settings"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (SESSION_COOKIES.some((c) => req.cookies.has(c))) return NextResponse.next();
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
