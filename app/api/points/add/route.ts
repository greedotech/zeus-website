// app/api/points/add/route.ts
import { NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = await req.json();
    const { user_id, amount, note } = body;

    if (!user_id || typeof amount !== "number") {
      return NextResponse.json(
        { error: "user_id and amount are required." },
        { status: 400 }
      );
    }

    // 1) log the transaction
    const { error: txErr } = await supabaseAdmin
      .from("coin_transactions")
      .insert({
        user_id,
        amount,
        type: amount > 0 ? "host_add" : "host_adjust",
        note: note || null,
      });

    if (txErr) throw txErr;

    // 2) read current balance
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins")
      .eq("id", user_id)
      .maybeSingle();

    if (profileErr) throw profileErr;

    const currentBalance = profileRow?.zeus_coins ?? 0;
    const updatedBalance = currentBalance + amount;

    // 3) update profile balance
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ zeus_coins: updatedBalance })
      .eq("id", user_id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      new_balance: updatedBalance,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update coins", detail: e.message },
      { status: 500 }
    );
  }
}