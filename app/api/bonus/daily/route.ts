// app/api/bonus/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { getTierForCoins, getExtraDailySpinsForTier } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export type SpinReward = {
  label: string;
  value: number;
  type: "coins" | "match" | "freeplay" | "none";
  weight: number;
};

const REWARDS: SpinReward[] = [
  { label: "No reward today",  value: 0,   type: "none",     weight: 5   },
  { label: "+25 Zeus Coins",   value: 25,  type: "coins",    weight: 4   },
  { label: "+50 Zeus Coins",   value: 50,  type: "coins",    weight: 3   },
  { label: "+100 Zeus Coins",  value: 100, type: "coins",    weight: 3   },
  { label: "+250 Zeus Coins",  value: 250, type: "coins",    weight: 2   },
  { label: "+500 Zeus Coins",  value: 500, type: "coins",    weight: 1   },
  { label: "25% Match Bonus",  value: 25,  type: "match",    weight: 1   },
  { label: "50% Match Bonus",  value: 50,  type: "match",    weight: 1   },
  { label: "$10 Free Play",    value: 10,  type: "freeplay", weight: 0.5 },
  { label: "$25 Free Play",    value: 25,  type: "freeplay", weight: 0.5 },
];

function pickReward(): SpinReward {
  const totalWeight = REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const reward of REWARDS) {
    rand -= reward.weight;
    if (rand <= 0) return reward;
  }
  return REWARDS[0];
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user?.id) return data.user.id;
    }
  }
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return data.user.id;
}

function getStartOfDayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getNextMidnightUTC(): Date {
  const d = getStartOfDayUTC();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// ─── GET: check today's spin status ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("lifetime_coins")
      .eq("id", userId)
      .maybeSingle();

    const lifetimeCoins = profileRow?.lifetime_coins ?? 0;
    const tier = getTierForCoins(lifetimeCoins);
    const allowedSpins = getExtraDailySpinsForTier(tier);

    const { data: todaySpins } = await supabaseAdmin
      .from("daily_spins")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", getStartOfDayUTC().toISOString());

    const spinsUsed = todaySpins?.length ?? 0;
    const spinsRemaining = Math.max(0, allowedSpins - spinsUsed);

    return NextResponse.json({
      spinsRemaining,
      spinsAllowed: allowedSpins,
      spinsUsed,
      tier,
      cooldownEndsAt: getNextMidnightUTC().toISOString(),
    });
  } catch (e) {
    console.error("daily spin GET - unexpected error:", e);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

// ─── POST: perform a spin ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Load profile to determine tier and allowed spins
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins, lifetime_coins")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("daily spin - profile error:", profileErr);
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const lifetimeCoins = profileRow?.lifetime_coins ?? 0;
    const tier = getTierForCoins(lifetimeCoins);
    const allowedSpins = getExtraDailySpinsForTier(tier);

    // 3) Count spins used today (since midnight UTC)
    const { data: todaySpins, error: spinsErr } = await supabaseAdmin
      .from("daily_spins")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", getStartOfDayUTC().toISOString());

    if (spinsErr) {
      console.error("daily spin - spins count error:", spinsErr);
      return NextResponse.json({ error: "Failed to check spin count" }, { status: 500 });
    }

    const spinsUsedToday = todaySpins?.length ?? 0;

    if (spinsUsedToday >= allowedSpins) {
      return NextResponse.json(
        {
          error: "No spins remaining today.",
          spinsUsed: spinsUsedToday,
          spinsAllowed: allowedSpins,
          cooldownEndsAt: getNextMidnightUTC().toISOString(),
        },
        { status: 429 }
      );
    }

    // 4) Pick reward
    const chosen = pickReward();

    // 5) Log spin
    const { error: insertErr } = await supabaseAdmin.from("daily_spins").insert({
      user_id: userId,
      reward: chosen.value,
      label: chosen.label,
      type: chosen.type,
      note: "",
    });

    if (insertErr) {
      console.error("daily spin - insert error:", insertErr);
      return NextResponse.json({ error: "Failed to record daily spin" }, { status: 500 });
    }

    // 6) Coin rewards -> update zeus_coins + lifetime_coins
    if (chosen.type === "coins" && chosen.value > 0) {
      const currentCoins = profileRow?.zeus_coins ?? 0;
      const currentLifetime = profileRow?.lifetime_coins ?? 0;

      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update({
          zeus_coins: currentCoins + chosen.value,
          lifetime_coins: currentLifetime + chosen.value,
        })
        .eq("id", userId);

      if (updateErr) console.error("profile update error:", updateErr);

      const { error: txErr } = await supabaseAdmin
        .from("coin_transactions")
        .insert({
          user_id: userId,
          amount: chosen.value,
          type: "spin",
          note: chosen.label,
        });

      if (txErr) console.error("coin_transactions error:", txErr);
    }

    // 7) Return reward + remaining spins info
    const spinsRemaining = allowedSpins - spinsUsedToday - 1;

    return NextResponse.json({
      success: true,
      label: chosen.label,
      value: chosen.value,
      type: chosen.type,
      spinsRemaining,
      spinsAllowed: allowedSpins,
      tier,
    });
  } catch (e) {
    console.error("daily spin - unexpected error:", e);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}