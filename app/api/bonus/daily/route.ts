// app/api/bonus/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export type SpinReward = {
  label: string;
  value: number;
  type: "coins" | "match" | "freeplay" | "none";
};

const REWARDS: SpinReward[] = [
  // 6 coin rewards
  { label: "+100 Zeus Coins", value: 100, type: "coins" },
  { label: "+250 Zeus Coins", value: 250, type: "coins" },
  { label: "+500 Zeus Coins", value: 500, type: "coins" },
  { label: "+750 Zeus Coins", value: 750, type: "coins" },
  { label: "+1,000 Zeus Coins", value: 1000, type: "coins" },
  { label: "+1,500 Zeus Coins", value: 1500, type: "coins" },

  // 4 match rewards
  { label: "25% Match (all day)", value: 25, type: "match" },
  { label: "50% Match (all day)", value: 50, type: "match" },
  { label: "75% Match (one time)", value: 75, type: "match" },
  { label: "100% Match (one time)", value: 100, type: "match" },

  // 2 free play rewards
  { label: "$10 Free Play", value: 10, type: "freeplay" },
  { label: "$25 Free Play", value: 25, type: "freeplay" },

  // 3 no reward slots
  { label: "No reward today", value: 0, type: "none" },
  { label: "No reward today", value: 0, type: "none" },
  { label: "No reward today", value: 0, type: "none" },
];

const COOLDOWN_HOURS = 24;

function pickReward() {
  return REWARDS[Math.floor(Math.random() * REWARDS.length)];
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  // 1) Prefer Bearer token if provided
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user?.id) return data.user.id;
    }
  }

  // 2) Fallback: cookie-based auth (keeps your current wheel call working)
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return data.user.id;
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Cooldown check (admin client)
    const { data: lastSpin, error: lastErr } = await supabaseAdmin
      .from("daily_spins")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error("daily spin - lastSpin error:", lastErr);
      // don’t hard fail here; you can decide if you want to return 500 instead
    }

    if (lastSpin?.created_at) {
      const last = new Date(lastSpin.created_at);
      const now = new Date();
      const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

      if (diffHours < COOLDOWN_HOURS) {
        const cooldownEndsAt = new Date(
          last.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
        ).toISOString();

        return NextResponse.json(
          { error: "Cooldown active", cooldownEndsAt },
          { status: 429 }
        );
      }
    }

    // 3) Pick reward
    const chosen = pickReward();

    // 4) Log spin
    const { error: insertErr } = await supabaseAdmin.from("daily_spins").insert({
      user_id: userId,
      reward: chosen.value,
      label: chosen.label,
      type: chosen.type,
      note: "",
    });

    if (insertErr) {
      console.error("daily spin - insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to record daily spin" },
        { status: 500 }
      );
    }

    // 5) Coin rewards -> update profile & ledger
    if (chosen.type === "coins" && chosen.value > 0) {
      const { data: profileRow, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("zeus_coins")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr) {
        console.error("profile fetch error:", profileErr);
      } else {
        const currentCoins = profileRow?.zeus_coins ?? 0;
        const newCoins = currentCoins + chosen.value;

        const { error: updateErr } = await supabaseAdmin
          .from("profiles")
          .update({ zeus_coins: newCoins })
          .eq("id", userId);

        if (updateErr) console.error("profile update error:", updateErr);

        const { error: ledgerErr } = await supabaseAdmin
          .from("coin_ledger")
          .insert({
            user_id: userId,
            amount: chosen.value,
            type: "daily_spin",
            note: chosen.label,
          });

        if (ledgerErr) console.error("ledger error:", ledgerErr);
      }
    }

    // 6) Return reward
    return NextResponse.json({
      success: true,
      label: chosen.label,
      value: chosen.value,
      type: chosen.type,
    });
  } catch (e) {
    console.error("daily spin - unexpected error:", e);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}