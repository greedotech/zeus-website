// app/api/host/_utils.ts
import supabaseAdmin from "@/lib/supabaseAdmin";

export type HostContext = {
  userId: string;
};

function json(
  body: any,
  status: number = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Read "Authorization: Bearer <access_token>" header,
// verify via Supabase, then check profiles.is_host = true.
export async function requireHost(req: Request): Promise<{
  ctx?: HostContext;
  response?: Response;
}> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return {
      response: json({ error: "Missing Authorization bearer token." }, 401),
    };
  }

  // Validate the JWT with Supabase
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return {
      response: json({ error: "Invalid or expired token." }, 401),
    };
  }

  const userId = data.user.id;

  // Check host flag in profiles
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("is_host")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr || !profile?.is_host) {
    return {
      response: json({ error: "Host permissions required." }, 403),
    };
  }

  return { ctx: { userId } };
}