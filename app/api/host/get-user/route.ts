// app/api/host/get-user/route.ts
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/host/get-user
// Body: { query: string }
// query is usually username (or part of it)
export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!; // not a host → handled in requireHost

  try {
    const body = await req.json();
    const { query } = body as { query?: string };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return json({ error: "Please provide a username to search." }, 400);
    }

    const q = query.trim();

    // 🔎 Search by username (partial match)
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, first_name, last_name, username, zeus_coins, referred_by, invite_code"
      )
      .ilike("username", `%${q}%`)
      .limit(20);

    if (error) {
      console.error("get-user error:", error);
      return json({ error: "Failed to search for user." }, 500);
    }

    return json({ users: data ?? [] });
  } catch (e) {
    console.error("get-user unexpected:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}