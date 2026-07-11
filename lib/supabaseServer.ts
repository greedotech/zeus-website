// lib/supabaseServer.ts
//
// Server-side client for Route Handlers (app/api/**/route.ts), built on
// @supabase/ssr. Replaces the deprecated createRouteHandlerClient from
// @supabase/auth-helpers-nextjs.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a context that can't mutate cookies (e.g. a
            // Server Component render). Safe to ignore — middleware.ts
            // handles refreshing the session cookie on every request.
          }
        },
      },
    }
  );
}
