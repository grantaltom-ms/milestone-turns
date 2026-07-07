import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          // In a Server Component render, cookies() is read-only and .set()
          // throws ("Cookies can only be modified in a Server Action or Route
          // Handler"). The middleware (proxy.ts) is responsible for persisting
          // refreshed session cookies, so it's safe to ignore writes here.
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // read-only cookie store (Server Component) — middleware handles refresh
          }
        },
      },
    },
  );
}
