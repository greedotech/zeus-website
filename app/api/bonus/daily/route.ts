// app/api/bonus/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { getExtraDailySpinsForCoins } from "@/lib/tiers";

type SpinReward = {
  label: string;
  value: number;
};

// 🎁 Reward table (15 slices, but text now only shown in the list on the page)
// We keep the labels here for logs + return JSON.
const REWARDS: SpinReward[] = [
  // 6 coin rewards (higher chance overall)
  { label: "+100 Zeus Coins", value: 100 },
  { label: "+150 Zeus Coins", value: 150 },
  { label: "+200 Zeus Coins", value: 200 },
  { label: "+250 Zeus Coins", value: 250 },
  { label: "+300 Zeus Coins", value: 300 },
  { label: "+500 Zeus Coins", value: 500 },

  // 4 match rewards (25, 50, 75, 100)
  { label: "25% match bonus", value: 0 },
  { label: "50% match bonus", value: 0 },
  { label: "75% one-time match", value: 0 },
  { label: "100% one-time match", value: 0 },

  // 2 free play rewards
  { label: "$10 free play", value: 0 },
  { label: "$25 free play", value: 0 },

  // 3 no reward slices
  { label: "No reward today", value: 0 },
  { label: "No reward today", value: 0 },
  { label: "No reward today", value: 0 },
];

// 24-hour rolling window for “today”
const WINDOW_HOURS = 24;

export async function POST(req: NextRequest) {
  // 1) Get logged-in user from auth cookies
  const supabaseBrowser = createRouteHandlerClient({ cookies });

  const { data: auth, error: authErr } = await supabaseBrowser.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = auth.user.id;

  // 2) Load profile to get Zeus Coins (for tier)
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, zeus_coins")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    console.error("daily spin - profile error:", profileErr);
    return NextResponse.json(
      { error: "Unable to load profile" },
      { status: 500 }
    );
  }

  const currentCoins = profile?.zeus_coins ?? 0;

  // Tier-based spins per day
  const extraSpins = getExtraDailySpinsForCoins(currentCoins); // from tiers.ts
  const maxSpinsPerDay = 1 + extraSpins;

  // 3) Count spins in the last 24 hours
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: spinsToday, error: spinsErr } = await supabaseAdmin
    .from("daily_spins")
    .select("id, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (spinsErr) {
    console.error("daily spin - spinsToday error:", spinsErr);
    return NextResponse.json(
      { error: "Unable to check daily spin usage" },
      { status: 500 }
    );
  }

  const usedToday = spinsToday?.length ?? 0;

  // If already used all allowed spins, block & tell them when window resets
  if (usedToday >= maxSpinsPerDay) {
    let cooldownEndsAt: string | null = null;
    if (spinsToday && spinsToday.length > 0) {
      const firstSpin = new Date(spinsToday[0].created_at);
      cooldownEndsAt = new Date(
        firstSpin.getTime() + WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();
    }

    return NextResponse.json(
      {
        error: "No spins left for today.",
        maxSpinsPerDay,
        usedToday,
        cooldownEndsAt,
      },
      { status: 429 }
    );
  }

  // 4) Pick a random reward
  const idx = Math.floor(Math.random() * REWARDS.length);
  const chosen = REWARDS[idx];

  // 5) Log the spin
  const { error: insertErr } = await supabaseAdmin.from("daily_spins").insert({
    user_id: userId,
    reward: chosen.value,
    label: chosen.label,
    note: "", // note column is NOT NULL
  });

  if (insertErr) {
    console.error("daily spin - insert error:", insertErr);
    return NextResponse.json(
      { error: "Failed to record daily spin" },
      { status: 500 }
    );
  }

  // 6) If this spin grants Zeus Coins, update profile balance automatically
  if (chosen.value > 0) {
    const newBalance = currentCoins + chosen.value;

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ zeus_coins: newBalance })
      .eq("id", userId);

    if (updateErr) {
      console.error("daily spin - update coins error:", updateErr);
      // We don't fail the whole request here; worst case: they see the reward
      // but balance didn't update, and you can fix it manually from host console.
    }
  }

  // 7) Return result to the client
  return NextResponse.json({
    success: true,
    reward: chosen.value,
    label: chosen.label,
    spinsUsed: usedToday + 1,
    maxSpinsPerDay,
  });
}