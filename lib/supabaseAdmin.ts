// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,          // same URL
  process.env.SUPABASE_SERVICE_ROLE_KEY!,        // 🔒 server-only key
  {
    auth: {
      persistSession: false,
    },
  }
);

export default supabaseAdmin;