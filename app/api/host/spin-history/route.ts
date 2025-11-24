// app/api/host/spin-history/route.ts

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

type SpinHistoryBody = {
  userId: string;
  limit?: number;
};

// POST /api/host/spin-history
// Body: { userId: string, limit?: number }
export async function POST(req: Request) {
  // 🔒 Only allow authenticated HOST accounts
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as SpinHistoryBody;
    const { userId, limit } = body;

    if (!userId) {
      return json({ error: "Missing userId." }, 400);
    }

    const rowLimit =
      typeof limit === "number" && limit > 0 && limit <= 100 ? limit : 25;

    // Read daily spins for this user
    const { data, error } = await supabaseAdmin
      .from("daily_spins")
      .select("id, spun_at, prize_label, prize_type, prize_value")
      .eq("user_id", userId)
      .order("spun_at", { ascending: false })
      .limit(rowLimit);

    if (error) {
      console.error("spin-history error:", error);
      return json({ error: "Failed to load spin history." }, 500);
    }

    return json({
      userId,
      spins: data || [],
    });
  } catch (e) {
    console.error("spin-history unexpected error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}