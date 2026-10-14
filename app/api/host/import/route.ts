// app/api/host/import/route.ts
// POST { filename, content }  -> CSV daily report (per player, one business day) -> replaces that day
// POST { filename, base64 }   -> Excel top-up records (per transaction)          -> adds new orders, skips known ones
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import readXlsxFile from "read-excel-file/node";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";
import { parseReport } from "@/lib/platformImport";
import { parseTransactions, looksLikeTransactions } from "@/lib/platformTransactions";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function unlinkedAmong(platform: string, accounts: string[]) {
  if (!accounts.length) return [];
  const { data } = await supabaseAdmin
    .from("player_accounts")
    .select("account_number")
    .eq("platform", platform)
    .is("member_id", null)
    .in("account_number", Array.from(new Set(accounts)));
  return (data || []).map((u) => u.account_number);
}

type GameChoice = { game?: string; remember?: boolean };

// Resolve which game a file belongs to.
//  - a specific game code from the dropdown wins (optionally remembered as the panel's usual game)
//  - "both" = several games, not separated
//  - "" / missing = use the panel's usual game; error if the panel has none
async function resolveGame(platform: string, choice: GameChoice): Promise<{ game: string | null; error?: string }> {
  await supabaseAdmin.from("platform_panels").upsert({ platform }, { onConflict: "platform", ignoreDuplicates: true });
  const { data: panel } = await supabaseAdmin.from("platform_panels").select("default_game").eq("platform", platform).maybeSingle();
  const chosen = (choice.game || "").trim();

  if (chosen === "both") return { game: null };
  if (chosen) {
    const { data: g } = await supabaseAdmin.from("games").select("code").eq("code", chosen).maybeSingle();
    if (!g) return { game: null, error: `Unknown game "${chosen}".` };
    if (choice.remember && !panel?.default_game) {
      await supabaseAdmin.from("platform_panels").update({ default_game: chosen }).eq("platform", platform);
    }
    return { game: chosen };
  }
  if (panel?.default_game) return { game: panel.default_game };
  return {
    game: null,
    error: `The "${platform}" panel carries more than one game (or is new). Choose the game in the dropdown and upload again.`,
  };
}

async function importExcel(filename: string, base64: string, userId: string, choice: GameChoice) {
  let table: unknown[][];
  try {
    table = (await readXlsxFile(Buffer.from(base64, "base64"))) as unknown[][];
  } catch {
    return json({ error: "Couldn't open this Excel file. Make sure it's an .xlsx export from the game panel." }, 400);
  }

  if (!table.some((r) => looksLikeTransactions(r))) {
    const head = (table[0] || []).map((x) => String(x ?? "").toLowerCase());
    if (head.includes("user name") && (head.includes("win") || head.includes("profit"))) {
      return json({
        error: 'This is the "Player Total Report" (profit only, no deposits or dates). Export the top-up records from Record Enquiry instead.',
      }, 400);
    }
    return json({ error: "This Excel file isn't a format the upload page knows yet. Send it to Claude to add support." }, 400);
  }

  let parsed;
  try {
    parsed = parseTransactions(table);
  } catch (e: any) {
    return json({ error: e?.message || "Couldn't read the file." }, 400);
  }
  if (!parsed.rows.length) return json({ error: "The file has no deposit rows, so nothing was changed." }, 400);

  const g = await resolveGame(parsed.platform, choice);
  if (g.error) return json({ error: g.error }, 400);

  const { data, error } = await supabaseAdmin.rpc("import_platform_transactions", {
    p_platform: parsed.platform,
    p_source_file: filename,
    p_uploaded_by: userId,
    p_rows: parsed.rows,
    p_game: g.game,
  });
  if (error) {
    console.error("import_platform_transactions error:", error);
    return json({ error: error.message }, 400);
  }

  return json({
    success: true,
    kind: "transactions",
    platform: parsed.platform,
    summary: data,
    unlinkedInFile: await unlinkedAmong(parsed.platform, parsed.rows.map((r) => r.account_number)),
    warnings: parsed.warnings,
  });
}

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const { filename, content, base64, game, remember } = (await req.json()) as {
      filename?: string; content?: string; base64?: string; game?: string; remember?: boolean;
    };
    if (!filename) return json({ error: "Missing file." }, 400);

    if (typeof base64 === "string") {
      if (base64.length > 3_000_000) return json({ error: "File is too large (max about 2 MB)." }, 400);
      return await importExcel(filename, base64, ctx.userId, { game, remember });
    }

    if (typeof content !== "string") return json({ error: "Missing file." }, 400);
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

    const g = await resolveGame(parsed.platform, { game, remember });
    if (g.error) return json({ error: g.error }, 400);

    const { data, error } = await supabaseAdmin.rpc("import_platform_day", {
      p_platform: parsed.platform,
      p_period_start: parsed.periodStart,
      p_period_end: parsed.periodEnd,
      p_source_file: filename,
      p_uploaded_by: ctx.userId,
      p_rows: parsed.rows,
      p_game: g.game,
    });
    if (error) {
      console.error("import_platform_day error:", error);
      return json({ error: error.message }, 400);
    }

    return json({
      success: true,
      kind: "daily_totals",
      platform: parsed.platform,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      summary: data,
      unlinkedInFile: await unlinkedAmong(parsed.platform, parsed.rows.map((r) => r.account_number)),
      warnings: parsed.warnings,
    });
  } catch (e) {
    console.error("import: unexpected error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}
