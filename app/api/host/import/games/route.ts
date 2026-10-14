// app/api/host/import/games/route.ts
// GET -> game list (for dropdowns) + known panels with their usual game
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  const [{ data: games, error: gErr }, { data: panels, error: pErr }] = await Promise.all([
    supabaseAdmin.from("games").select("code, name").eq("active", true).order("sort_order"),
    supabaseAdmin.from("platform_panels").select("platform, default_game, notes").order("platform"),
  ]);
  if (gErr || pErr) return json({ error: (gErr || pErr)!.message }, 500);
  return json({ games: games || [], panels: panels || [] });
}
