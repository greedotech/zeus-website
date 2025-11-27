// app/api/bonus/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SpinReward = {
  label: string;
  value: number;
};

// Server-side reward table (edit these however you want)
const REWARDS: SpinReward[] = [
  { label: "No win today", value: 0 },
  { label: "+100 Zeus Coins", value: 100 },
  { label: "+250 Zeus Coins", value: 250 },
  { label: "+500 Zeus Coins", value: 500 },
];

const COOLDOWN_HOURS = 24;

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1) Auth – normal player, NOT host-only
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = auth.user;

  // 2) Check last spin for cooldown
  const { data: lastSpin, error: lastErr } = await supabase
    .from("daily_spins")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) {
    console.error("daily spin - lastSpin error:", lastErr);
  }

  if (lastSpin?.created_at) {
    const last = new Date(lastSpin.created_at);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < COOLDOWN_HOURS) {
      const nextAvailable = new Date(
        last.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
      ).toISOString();

      return NextResponse.json(
        {
          error: "Cooldown active",
          cooldownEndsAt: nextAvailable,
        },
        { status: 429 }
      );
    }
  }

  // 3) Pick random reward on the server
  const idx = Math.floor(Math.random() * REWARDS.length);
  const chosen = REWARDS[idx];

  // 4) Log spin – note is NOT nullable in your table, so we store the label
  const { error: insertErr } = await supabase.from("daily_spins").insert({
    user_id: user.id,
    reward: chosen.value,
    label: chosen.label,
    note: chosen.label, // 🔑 this keeps NOT NULL constraints happy
  });

  if (insertErr) {
    console.error("daily spin - insert error:", insertErr);
    return NextResponse.json(
      { error: "Failed to record daily spin" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    reward: chosen.value,
    label: chosen.label,
  });
}