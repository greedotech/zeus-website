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

type GetUserBody = {
  email?: string;
  username?: string;
  inviteCode?: string;
};

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as GetUserBody;
    const { email, username, inviteCode } = body;

    if (!email && !username && !inviteCode) {
      return json(
        { error: "Provide email, username, or inviteCode to search." },
        400
      );
    }

    let query = supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        username,
        zeus_coins,
        referred_by,
        invite_code,
        favorite_game,
        email,
        account_tier,
        lifetime_coins_spent
        `
      )
      .limit(20);

    if (inviteCode) {
      query = query.eq("invite_code", inviteCode);
    } else if (username) {
      query = query.ilike("username", `${username}%`);
    } else if (email) {
      query = query.ilike("email", `${email}%`);
    }

    // ✅ Execute and return
    const { data, error } = await query;

    if (error) {
      console.error("get-user error:", error);
      return json({ error: error.message }, 500);
    }

    if (!data || data.length === 0) {
      return json({ error: "No user found." }, 404);
    }

    return json({ users: data });

  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error." }, 500);
  }
}