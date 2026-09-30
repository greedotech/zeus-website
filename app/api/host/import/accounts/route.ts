// app/api/host/import/accounts/route.ts
// GET  -> all platform accounts with lifetime totals and linked member (unlinked first)
// POST { platform, account_number, member_id | null } -> link / unlink an account
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  const { data: accounts, error } = await supabaseAdmin
    .from("player_accounts")
    .select(
      "platform, account_number, display_name, member_id, linked_at, member:profiles!player_accounts_member_id_fkey(id, username, first_name, last_name, email)"
    )
    .limit(5000);
  if (error) return json({ error: error.message }, 500);

  const { data: totals, error: tErr } = await supabaseAdmin
    .from("platform_daily_totals")
    .select("platform, account_number, business_date, total_in, total_out")
    .limit(100000);
  if (tErr) return json({ error: tErr.message }, 500);

  const agg = new Map<string, { total_in: number; total_out: number; days: number; last_seen: string | null }>();
  for (const t of totals || []) {
    const k = `${t.platform}|${t.account_number}`;
    const a = agg.get(k) || { total_in: 0, total_out: 0, days: 0, last_seen: null };
    a.total_in += Number(t.total_in) || 0;
    a.total_out += Number(t.total_out) || 0;
    a.days += 1;
    if (!a.last_seen || t.business_date > a.last_seen) a.last_seen = t.business_date;
    agg.set(k, a);
  }

  const rows = (accounts || []).map((a: any) => {
    const s = agg.get(`${a.platform}|${a.account_number}`) || { total_in: 0, total_out: 0, days: 0, last_seen: null };
    return {
      ...a,
      total_in: Math.round(s.total_in * 100) / 100,
      total_out: Math.round(s.total_out * 100) / 100,
      days: s.days,
      last_seen: s.last_seen,
    };
  });
  rows.sort((x, y) => (x.member_id ? 1 : 0) - (y.member_id ? 1 : 0) || y.total_in - x.total_in);

  return json({ accounts: rows });
}

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const { platform, account_number, member_id } = (await req.json()) as {
      platform?: string;
      account_number?: string;
      member_id?: string | null;
    };
    if (!platform || !account_number) return json({ error: "Missing platform or account number." }, 400);

    if (member_id) {
      const { data: member } = await supabaseAdmin.from("profiles").select("id").eq("id", member_id).maybeSingle();
      if (!member) return json({ error: "Member not found." }, 404);
    }

    const { data, error } = await supabaseAdmin
      .from("player_accounts")
      .update({
        member_id: member_id || null,
        linked_by: member_id ? ctx.userId : null,
        linked_at: member_id ? new Date().toISOString() : null,
      })
      .eq("platform", platform)
      .eq("account_number", account_number)
      .select("platform, account_number, member_id")
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Account not found." }, 404);

    return json({ success: true, account: data });
  } catch (e) {
    console.error("link account error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}
