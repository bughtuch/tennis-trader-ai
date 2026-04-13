// Auth + CSP middleware
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = [
  "/",
  "/auth",
  "/contact",
  "/terms",
  "/privacy",
  "/risk",
  "/cookies",
  "/api",
];

function isPublic(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/* ─── CSP with per-request nonce ─── */

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.betfair.com https://identitysso.betfair.com https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.api-tennis.com https://api.stripe.com",
    "frame-src 'self' https://js.stripe.com https://identitysso.betfair.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function applyNonceHeaders(
  request: NextRequest,
  response: NextResponse,
  nonce: string
) {
  const csp = buildCsp(nonce);
  request.headers.set("x-nonce", nonce);
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", csp);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a unique nonce for this request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  if (isPublic(pathname)) {
    const response = NextResponse.next({
      request: { headers: request.headers },
    });
    applyNonceHeaders(request, response, nonce);
    return response;
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log("[middleware]", pathname, "user:", user?.id ?? "NONE", "email:", user?.email ?? "NONE", "error:", authError?.message ?? "none");

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  applyNonceHeaders(request, response, nonce);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
