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
// Body: { email?: string, username?: string }
export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = await req.json();
    const { email, username } = body as {
      email?: string;
      username?: string;
    };

    if (!email && !username) {
      return json(
        { error: "Provide email or username." },
        400
      );
    }

    let query = supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, username, zeus_coins, referred_by, invite_code")
      .limit(10);

    if (username) {
      query = query.ilike("username", username);
    }

    if (email) {
      // only works if you have email on profiles;
      // if not, you can look up via auth.users with RPC instead.
      query = query.eq("email", email);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return json(
        { error: "Failed to search for user." },
        500
      );
    }

    if (!data || data.length === 0) {
      return json({ users: [] });
    }

    return json({ users: data });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected server error." }, 500);
  }
}