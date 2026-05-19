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

function coinsForDeposit(depositAmount: number) {
  if (depositAmount >= 10 && depositAmount <= 24.99) return 100;
  if (depositAmount >= 25 && depositAmount <= 49.99) return 250;
  if (depositAmount >= 50 && depositAmount <= 99.99) return 600;
  if (depositAmount >= 100) return 1200;
  return 0;
}

type AddCoinsBody = {
  user_id?: string;
  amount?: number;
  deposit_amount?: number;
  note?: string;
  source?: "deposit" | "facebook" | "spin" | "manual";
  game?: string | null;
};

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as AddCoinsBody;
    const { user_id, amount, deposit_amount, note, source, game } = body;

    if (!user_id) return json({ error: "Missing user_id" }, 400);

    // Determine coin delta
    let coinDelta: number | null = null;

    if (source === "deposit") {
      if (typeof deposit_amount === "number" && Number.isFinite(deposit_amount)) {
        coinDelta = coinsForDeposit(deposit_amount);
        if (!coinDelta) return json({ error: "Deposit amount does not qualify for coins." }, 400);
      } else {
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
          return json({ error: "Missing or invalid deposit_amount/amount" }, 400);
        }
        coinDelta = amount;
      }
    } else {
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
        return json({ error: "Missing or invalid amount" }, 400);
      }
      coinDelta = amount;
    }

    // 1) Load current profile
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins, lifetime_coins, favorite_game")
      .eq("id", user_id)
      .maybeSingle();

    if (profErr) {
      console.error("add-coins: profile load error:", profErr);
      return json({ error: "Failed to load profile" }, 500);
    }

    const currentCoins = profile?.zeus_coins ?? 0;
    const currentLifetime = profile?.lifetime_coins ?? 0;
    const newCoins = currentCoins + coinDelta;

    // Only increment lifetime coins when adding (not removing)
    const newLifetime = coinDelta > 0
      ? currentLifetime + coinDelta
      : currentLifetime;

    const txType =
      source === "deposit" ? "deposit" :
      source === "facebook" ? "facebook" :
      source === "spin" ? "spin" : "manual";

    // 2) Update profile
    const profileUpdate: Record<string, any> = {
      zeus_coins: newCoins,
      lifetime_coins: newLifetime,
    };

    if (txType === "deposit" && game) {
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

    // 3) Log transaction
    const { error: txErr } = await supabaseAdmin.from("coin_transactions").insert({
      user_id,
      amount: coinDelta,
      type: txType,
      note:
        source === "deposit" && typeof deposit_amount === "number"
          ? `${note ?? ""}`.trim() || `Deposit: $${deposit_amount}`
          : note ?? null,
    });

    if (txErr) {
      console.error("add-coins: tx insert error:", txErr);
    }

    return json({
      success: true,
      newBalance: newCoins,
      lifetimeCoins: newLifetime,
      added: coinDelta,
    });
  } catch (e) {
    console.error("add-coins: unexpected error:", e);
    return json({ error: "Unexpected server error" }, 500);
  }
}