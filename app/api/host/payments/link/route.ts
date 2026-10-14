// app/api/host/payments/link/route.ts
// POST { handle_key, member_id | null } -> tie a payer (name / handle) to a Zeus member, or untie
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  const { handle_key, member_id } = (await req.json().catch(() => ({}))) as { handle_key?: string; member_id?: string | null };
  if (!handle_key) return json({ error: "Missing payer." }, 400);

  if (member_id) {
    const { data: m } = await supabaseAdmin.from("profiles").select("id").eq("id", member_id).maybeSingle();
    if (!m) return json({ error: "Member not found." }, 404);
  }

  const { data, error } = await supabaseAdmin
    .from("payer_handles")
    .update(member_id
      ? { member_id, linked_by: ctx.userId, linked_at: new Date().toISOString() }
      : { member_id: null, linked_by: null, linked_at: null })
    .eq("handle_key", handle_key)
    .select("handle_key")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Payer not found." }, 404);
  return json({ success: true });
}
