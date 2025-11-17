// app/api/host/add-coins/route.ts
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/host/add-coins
// Body: { userId: string, amount: number, note?: string }
export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!; // not authorized

  try {
    const body = await req.json();
    const { userId, amount, note } = body as {
      userId?: string;
      amount?: number;
      note?: string;
    };

    if (!userId || typeof amount !== "number") {
      return json(
        { error: "userId and amount are required." },
        400
      );
    }

    if (!Number.isFinite(amount) || amount === 0) {
      return json(
        { error: "Amount must be a non-zero number." },
        400
      );
    }

    // 1) Read current balance
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      return json(
        { error: "Player profile not found." },
        404
      );
    }

    const current = profile.zeus_coins ?? 0;
    const newBalance = current + amount;

    if (newBalance < 0) {
      return json(
        { error: "Resulting balance would be negative." },
        400
      );
    }

    // 2) Update balance
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ zeus_coins: newBalance })
      .eq("id", userId);

    if (updateErr) {
      console.error(updateErr);
      return json(
        { error: "Failed to update coin balance." },
        500
      );
    }

    // 3) Log transaction
    const { error: txErr } = await supabaseAdmin
      .from("coin_transactions")
      .insert({
        user_id: userId,
        amount,
        type: amount > 0 ? "host_award" : "host_adjust",
        note: note || "Host adjustment",
      });

    if (txErr) {
      console.error(txErr);
      // balance is already updated, so just warn:
      return json(
        {
          warning:
            "Balance updated, but transaction log failed. Check server logs.",
          newBalance,
        },
        200
      );
    }

    return json({ success: true, newBalance });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected server error." }, 500);
  }
}