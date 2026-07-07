import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Was `middleware.ts` pre-v16; renamed to `proxy.ts` per Next.js 16.

// Auth is always required — no env-var toggle. Public paths below are the only exceptions.
// Paths that never require auth
const PUBLIC_PREFIXES = ["/login", "/auth/", "/onboarding"];

export async function proxy(request: NextRequest) {
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

  // Refresh session (rotates tokens if needed). A stale/expired refresh token
  // makes getUser throw (AuthApiError: refresh_token_not_found) — that's just a
  // logged-out visitor, so treat any failure as "no user" instead of letting it
  // surface as a runtime error.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

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
  matcher: ["/((?!_next/|api/|.*\\..*).*)", "/"],
};
