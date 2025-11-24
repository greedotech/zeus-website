// app/api/host/get-user/route.ts

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

// POST /api/host/get-user
// Body: { email?: string, username?: string, inviteCode?: string }
export async function POST(req: Request) {
  // 🔒 Host-only guard
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
        email
      `
      )
      .limit(20);

    // Apply filters — we only use one at a time in a simple way
    if (inviteCode) {
      query = query.eq("invite_code", inviteCode);
    } else if (username) {
      // prefix match, case-insensitive
      query = query.ilike("username", `${username}%`);
    } else if (email) {
      // prefix match on email if you have an email column on profiles
      query = query.ilike("email", `${email}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("get-user query error:", error);
      return json({ error: "Failed to search for user." }, 500);
    }

    return json({
      users: data ?? [],
    });
  } catch (e) {
    console.error("get-user unexpected error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}