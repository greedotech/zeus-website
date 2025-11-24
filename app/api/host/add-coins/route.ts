// app/api/host/add-coins/route.ts
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type AddCoinsBody = {
  user_id: string;
  amount: number; // positive to add, negative to subtract
  note?: string;
};

// POST /api/host/add-coins
// Body: { user_id: string, amount: number, note?: string }
export async function POST(req: Request) {
  // 🔒 Ensure caller is a logged-in host
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as AddCoinsBody;
    const { user_id, amount, note } = body;

    if (!user_id || typeof amount !== "number" || !Number.isFinite(amount)) {
      return json(
        { error: "user_id and numeric amount are required." },
        400
      );
    }

    // 1) Get current coin balance
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("zeus_coins")
      .eq("id", user_id)
      .maybeSingle();

    if (profileErr) {
      console.error("Profile fetch error:", profileErr);
      return json({ error: "Failed to load profile." }, 500);
    }

    const current = profile?.zeus_coins ?? 0;
    const newBalance = current + amount;

    // 2) Update profile balance
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ zeus_coins: newBalance })
      .eq("id", user_id);

    if (updateErr) {
      console.error("Profile update error:", updateErr);
      return json({ error: "Failed to update coins." }, 500);
    }

    // 3) Log coin transaction (for audit)
    const { error: txErr } = await supabaseAdmin
      .from("coin_transactions")
      .insert({
        user_id,
        amount,
        type: amount > 0 ? "manual_adjust_add" : "manual_adjust_subtract",
        note: note || "Host adjustment",
      });

    if (txErr) {
      console.error("Transaction insert error:", txErr);
      // Don’t fail the whole request — coins are already updated
    }

    return json({ success: true, new_balance: newBalance });
  } catch (err) {
    console.error("add-coins route error:", err);
    return json({ error: "Unexpected server error." }, 500);
  }
}