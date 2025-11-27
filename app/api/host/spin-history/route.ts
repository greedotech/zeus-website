// app/api/host/spin-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

// GET /api/host/spin-history?user_id=...
export async function GET(req: NextRequest) {
  // 1) Host-only guard
  const { ctx, response } = await requireHost(req);
  if (!ctx) {
    // requireHost already built the correct 401/redirect response
    return response!;
  }

  // 2) Read user_id from query string
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing user_id" },
      { status: 400 }
    );
  }

  // 3) Query daily_spins for this user
  const { data, error } = await supabaseAdmin
    .from("daily_spins")
    .select("id, created_at, reward, label, note")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("host spin-history error:", error);
    return NextResponse.json(
      { error: "Failed to load spin history." },
      { status: 500 }
    );
  }

  // 4) Return rows for Host Console
  return NextResponse.json({
    rows: data ?? [],
  });
}