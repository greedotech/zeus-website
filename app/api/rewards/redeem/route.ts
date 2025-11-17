// app/api/rewards/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const REWARDS = {
  match_25: {
    label: "25% Deposit Match",
    cost: 4000,
  },
  match_50: {
    label: "50% Deposit Match",
    cost: 8000,
  },
  match_100: {
    label: "100% Deposit Match",
    cost: 15000,
  },
  freeplay_10: {
    label: "$10 Free Play",
    cost: 5000,
  },
  freeplay_50: {
    label: "$50 Free Play",
    cost: 20000,
  },
  freeplay_100: {
    label: "$100 Free Play",
    cost: 35000,
  },
} as const;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.rewardKey !== "string") {
    return NextResponse.json({ error: "Missing rewardKey" }, { status: 400 });
  }

  const reward = REWARDS[body.rewardKey as keyof typeof REWARDS];
  if (!reward) {
    return NextResponse.json({ error: "Unknown reward" }, { status: 400 });
  }

  const user = authData.user;

  // 1) Load current balance
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
  if (current < reward.cost) {
    return NextResponse.json(
      { error: "Not enough Zeus Coins for this reward.", balance: current },
      { status: 400 }
    );
  }

  const newBalance = current - reward.cost;

  // 2) Update profile balance
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ zeus_coins: newBalance })
    .eq("id", user.id);

  if (updErr) {
    console.error(updErr);
    return NextResponse.json({ error: "Failed to update coins" }, { status: 500 });
  }

  // 3) Insert redemption record
  const { error: redeemErr } = await supabase.from("reward_redemptions").insert({
    user_id: user.id,
    reward_key: body.rewardKey,
    reward_label: reward.label,
    zeus_coins_spent: reward.cost,
    status: "pending", // host can mark 'applied' in Supabase later
  });

  if (redeemErr) {
    console.error(redeemErr);
    // still continue; balance is already updated
  }

  // 4) Ledger entry
  const { error: ledgerErr } = await supabase.from("zeus_coin_ledger").insert({
    user_id: user.id,
    delta: -reward.cost,
    reason: "REDEMPTION",
    metadata: { reward_key: body.rewardKey, reward_label: reward.label },
  });

  if (ledgerErr) {
    console.error(ledgerErr);
  }

  return NextResponse.json({
    success: true,
    rewardKey: body.rewardKey,
    rewardLabel: reward.label,
    cost: reward.cost,
    balance: newBalance,
  });
}