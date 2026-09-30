// app/api/host/import/route.ts
// POST { filename, content } -> parse the game panel daily report and replace that business day.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";
import { parseReport } from "@/lib/platformImport";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const { filename, content } = (await req.json()) as { filename?: string; content?: string };
    if (!filename || typeof content !== "string") return json({ error: "Missing file." }, 400);
    if (content.length > 2_000_000) return json({ error: "File is too large (max 2 MB)." }, 400);

    let parsed;
    try {
      parsed = parseReport(filename, content);
    } catch (e: any) {
      return json({ error: e?.message || "Couldn't read the file." }, 400);
    }

    if (!parsed.periodStart.endsWith("05:00:00")) {
      return json({
        error: `This file starts at ${parsed.periodStart.slice(11, 16)}. Exports must start at 5:00 AM (the start of the business day). Re-export with the start time set to 5:00 AM.`,
      }, 400);
    }
    if (parsed.rows.length === 0) {
      return json({ error: "The file has no player rows, so nothing was changed." }, 400);
    }

    const { data, error } = await supabaseAdmin.rpc("import_platform_day", {
      p_platform: parsed.platform,
      p_period_start: parsed.periodStart,
      p_period_end: parsed.periodEnd,
      p_source_file: filename,
      p_uploaded_by: ctx.userId,
      p_rows: parsed.rows,
    });
    if (error) {
      console.error("import_platform_day error:", error);
      return json({ error: error.message }, 400);
    }

    // Which accounts in this file still need linking to a member?
    const { data: unlinked } = await supabaseAdmin
      .from("player_accounts")
      .select("account_number")
      .eq("platform", parsed.platform)
      .is("member_id", null)
      .in("account_number", parsed.rows.map((r) => r.account_number));

    return json({
      success: true,
      platform: parsed.platform,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      summary: data,
      unlinkedInFile: (unlinked || []).map((u) => u.account_number),
      warnings: parsed.warnings,
    });
  } catch (e) {
    console.error("import: unexpected error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}
