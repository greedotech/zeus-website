// app/api/bonus/spin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { label, value, kind } = body as {
    label: string;
    value: number;
    kind: "PERCENT" | "COINS";
  };

  if (!label || typeof value !== "number" || (kind !== "PERCENT" && kind !== "COINS")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // 1) Log the spin
  const { error: spinErr } = await supabase.from("bonus_spins").insert({
    user_id: user.id,
    result_label: label,
    result_value: value,
    result_kind: kind,
  });

  if (spinErr) {
    console.error(spinErr);
    return NextResponse.json({ error: "Failed to record spin" }, { status: 500 });
  }

  let newBalance: number | null = null;

  // 2) If this spin grants coins, update balance + ledger
  if (kind === "COINS" && value > 0) {
    // Get current balance
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("zeus_coins")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      console.error(profErr);
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const current = profile?.zeus_coins ?? 0;
    newBalance = current + value;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ zeus_coins: newBalance })
      .eq("id", user.id);

    if (updErr) {
      console.error(updErr);
      return NextResponse.json({ error: "Failed to update coins" }, { status: 500 });
    }

    // ledger entry
    const { error: ledgerErr } = await supabase.from("zeus_coin_ledger").insert({
      user_id: user.id,
      delta: value,
      reason: "SPIN",
      metadata: { label },
    });

    if (ledgerErr) {
      console.error(ledgerErr);
      // don't hard-fail the request if ledger insert fails; just log
    }
  }

  return NextResponse.json({
    success: true,
    kind,
    label,
    value,
    newBalance,
  });
}