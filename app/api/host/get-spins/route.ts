import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!; // not a host → 403

  try {
    const { userId } = await req.json();
    if (!userId) {
      return json({ error: "userId is required." }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("daily_spins")
      .select("id, spun_at, prize_label, prize_type, prize_value")
      .eq("user_id", userId)
      .order("spun_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error(error);
      return json({ error: "Failed to load daily spins." }, 500);
    }

    return json({ spins: data ?? [] });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected server error." }, 500);
  }
}