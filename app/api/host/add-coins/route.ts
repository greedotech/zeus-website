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
  user_id?: string;
  amount?: number;
  note?: string;
  source?: "deposit" | "facebook" | "spin" | "manual";
  game?: string | null;
};

export async function POST(req: Request) {
  // 🔒 Host-only guard
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as AddCoinsBody;
    const { user_id, amount, note, source, game } = body;

    if (!user_id || typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
      return json({ error: "Missing or invalid user_id/amount" }, 400);
    }

    // 1) Load current profile coins
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins, favorite_game")
      .eq("id", user_id)
      .maybeSingle();

    if (profErr) {
      console.error("add-coins: profile load error:", profErr);
      return json({ error: "Failed to load profile" }, 500);
    }

    const currentCoins = profile?.zeus_coins ?? 0;
    const newCoins = currentCoins + amount;

    // 2) Figure out what kind of adjustment this was
    const txType =
      source === "deposit"
        ? "DEPOSIT"
        : source === "facebook"
        ? "FACEBOOK"
        : source === "spin"
        ? "SPIN"
        : "MANUAL";

    // 3) Update profile (coins + maybe favorite_game on deposit)
    const profileUpdate: any = { zeus_coins: newCoins };

    if (txType === "DEPOSIT" && game) {
      profileUpdate.favorite_game = game;
    }

    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user_id);

    if (updErr) {
      console.error("add-coins: profile update error:", updErr);
      return json({ error: "Failed to update player balance" }, 500);
    }

    // 4) Log transaction in coin_transactions
    const { error: txErr } = await supabaseAdmin
      .from("coin_transactions")
      .insert({
        user_id,
        amount,
        type: txType,
        note: note ?? null,
      });

    if (txErr) {
      console.error("add-coins: tx insert error:", txErr);
      // don't hard fail – coins already updated. Just return success.
    }

    return json({
      success: true,
      newBalance: newCoins,
    });
  } catch (e) {
    console.error("add-coins: unexpected error:", e);
    return json({ error: "Unexpected server error" }, 500);
  }
}