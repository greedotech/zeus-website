import { createClient } from "@supabase/supabase-js";

// Create a single reusable client for the entire app
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);