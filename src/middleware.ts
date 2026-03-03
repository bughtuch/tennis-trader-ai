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

// Routes that require both auth AND active subscription
const subscriptionPaths = ["/markets", "/trading"];

function isPublic(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function requiresSubscription(pathname: string) {
  return subscriptionPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
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
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  // TODO: Re-enable subscription check before launch
  // if (requiresSubscription(pathname)) {
  //   const { data: profile } = await supabase
  //     .from("profiles")
  //     .select("subscription_status")
  //     .eq("id", user.id)
  //     .single();
  //
  //   if (profile?.subscription_status !== "active") {
  //     const settingsUrl = request.nextUrl.clone();
  //     settingsUrl.pathname = "/settings";
  //     settingsUrl.searchParams.set("subscribe", "true");
  //     return NextResponse.redirect(settingsUrl);
  //   }
  // }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
