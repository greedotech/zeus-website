// app/api/host/add-coins/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type AddCoinsBody = {
  userId: string;
  amount: number; // can be positive (add) or negative (remove)
  reason?: string;
};

// POST /api/host/add-coins
// Body: { userId: string, amount: number, reason?: string }
export async function POST(req: Request) {
  // 🔒 host-only guard
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as AddCoinsBody;
    const { userId, amount, reason } = body;

    if (!userId || typeof amount !== "number" || !Number.isFinite(amount)) {
      return json(
        { error: "Missing or invalid userId/amount." },
        400
      );
    }

    // 1) Get current balance
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("add-coins profile error:", profileErr);
      return json({ error: "Failed to load user profile." }, 500);
    }

    if (!profileRow) {
      return json({ error: "User not found." }, 404);
    }

    const currentCoins = profileRow.zeus_coins ?? 0;
    const newBalance = currentCoins + amount;

    if (newBalance < 0) {
      return json(
        { error: "This change would make the balance negative." },
        400
      );
    }

    // 2) Update profile balance
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ zeus_coins: newBalance })
      .eq("id", userId);

    if (updateErr) {
      console.error("add-coins update error:", updateErr);
      return json({ error: "Failed to update coin balance." }, 500);
    }

    // 3) Log transaction
    const { error: txErr } = await supabaseAdmin
      .from("coin_transactions")
      .insert({
        user_id: userId,
        amount,
        type: amount >= 0 ? "host_adjust" : "host_adjust_negative",
        note: reason || null,
      });

    if (txErr) {
      console.error("add-coins tx error:", txErr);
      // we already updated balance, so just report logging failure
      return json({
        error: "Balance updated, but failed to log transaction.",
        balance: newBalance,
      }, 500);
    }

    return json({
      success: true,
      userId,
      oldBalance: currentCoins,
      newBalance,
    });
  } catch (e) {
    console.error("add-coins unexpected error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}