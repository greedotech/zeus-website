import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only secret
);

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json();
    const inc = Number(amount) || 0;
    if (inc <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

    // identify the user from the bearer token sent by the client
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseForUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseForUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // increment points atomically using the service role
    const { error } = await supabaseAdmin.rpc("increment_points", { uid: user.id, inc });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}