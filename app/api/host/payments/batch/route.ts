// app/api/host/payments/batch/route.ts
// DELETE ?id=<upload id> -> undo a payment upload (removes the payments that upload added)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../../_utils";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function DELETE(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing upload id." }, 400);

  const { count } = await supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).eq("batch_id", id);
  // payments.batch_id cascades, so deleting the upload removes its rows
  const { data, error } = await supabaseAdmin
    .from("platform_import_batches").delete().eq("id", id).eq("kind", "payments").select("id").maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Upload not found." }, 404);

  // Drop payers that no longer have any payments and were never linked
  const { data: orphans } = await supabaseAdmin.from("payer_handles").select("handle_key, payments(id)").is("member_id", null).limit(5000);
  const gone = (orphans || []).filter((h: any) => !h.payments?.length).map((h: any) => h.handle_key);
  if (gone.length) await supabaseAdmin.from("payer_handles").delete().in("handle_key", gone);

  return json({ success: true, removed: count || 0 });
}
