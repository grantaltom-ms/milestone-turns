import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Was `middleware.ts` pre-v16; renamed to `proxy.ts` per Next.js 16.

// Set NEXT_PUBLIC_REQUIRE_AUTH=true to enforce login. Unset or empty = open access.
const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

// Paths that never require auth
const PUBLIC_PREFIXES = ["/login", "/auth/", "/onboarding"];

export async function proxy(request: NextRequest) {
  if (!REQUIRE_AUTH) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Let public paths through immediately
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Refresh session (rotates tokens if needed)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Not authenticated → redirect to /login with ?next= for return
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
