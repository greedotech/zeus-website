// app/api/bonus/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";

type SpinReward = {
  label: string;
  value: number;
};

// Server-side reward table
const REWARDS: SpinReward[] = [
  { label: "No win today", value: 0 },
  { label: "+100 Zeus Coins", value: 100 },
  { label: "+250 Zeus Coins", value: 250 },
  { label: "+500 Zeus Coins", value: 500 },
];

const COOLDOWN_HOURS = 24;

// Helper: read user from Authorization: Bearer <token>
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    console.error("daily spin - auth error:", error);
    return null;
  }

  return data.user;
}

export async function POST(req: NextRequest) {
  // 1) Auth via Bearer token
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Check last spin for cooldown
  const { data: lastSpin, error: lastErr } = await supabaseAdmin
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

  // 4) Log spin (note is NOT NULL in DB, so use empty string instead of null)
  const { error: insertErr } = await supabaseAdmin.from("daily_spins").insert({
    user_id: user.id,
    reward: chosen.value,
    label: chosen.label,
    note: "", // 👈 important: not null
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