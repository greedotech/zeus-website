// lib/supabaseClient.ts
//
// Browser client, built on @supabase/ssr (the officially supported
// replacement for the deprecated @supabase/auth-helpers-nextjs package).
// Every "use client" component in this app imports { supabase } from here,
// so fixing this one file fixes the auth/session hang everywhere it's used.
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);