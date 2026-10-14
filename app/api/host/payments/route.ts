// app/api/host/payments/route.ts
// GET  -> payment partners, money-vs-loads by business day, payers, recent payment uploads
// POST { filename, content | base64, partner, partnerName?, mapping?, dryRun? }
//        dryRun: read the file and show how its columns were matched (nothing saved)
//        otherwise: import (new transaction IDs added, known ones skipped) and remember the column mapping
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import readXlsxFile from "read-excel-file/node";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { requireHost } from "../_utils";
import {
  ColumnMap, PAY_FIELDS, findHeaderRow, guessMap, missingRequired, parseCsv, parsePayments, slugify,
} from "@/lib/paymentsImport";

function json(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const TZ = "America/New_York";
function storeDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/* ---------------- GET: overview ---------------- */

export async function GET(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 7), 120);

  const [partnersQ, reconQ, paymentsQ, handlesQ, uploadsQ] = await Promise.all([
    supabaseAdmin.from("payment_partners").select("code, name, column_map").order("name"),
    supabaseAdmin.rpc("payment_reconciliation", { p_from: storeDate(-days), p_to: storeDate(0) }),
    supabaseAdmin.from("payments")
      .select("handle_key, partner, method, payer_name, direction, amount, business_date, counted")
      .eq("counted", true).limit(200000),
    supabaseAdmin.from("payer_handles")
      .select("handle_key, display, member_id, linked_at, member:profiles!payer_handles_member_id_fkey(id, username, first_name, last_name, email)")
      .limit(20000),
    supabaseAdmin.from("platform_import_batches")
      .select("id, platform, period_start, period_end, account_count, total_in, total_out, new_rows, skipped_rows, source_file, uploaded_at, uploader:profiles!platform_import_batches_uploaded_by_fkey(username, first_name)")
      .eq("kind", "payments").order("uploaded_at", { ascending: false }).limit(30),
  ]);
  const err = partnersQ.error || reconQ.error || paymentsQ.error || handlesQ.error || uploadsQ.error;
  if (err) return json({ error: err.message }, 500);

  // Payers: lifetime money in / out per handle
  const agg = new Map<string, { paid_in: number; paid_out: number; count: number; days: Set<string>; last: string; partners: Set<string>; methods: Set<string>; names: Set<string> }>();
  for (const p of paymentsQ.data || []) {
    if (!p.handle_key) continue;
    const a = agg.get(p.handle_key) || { paid_in: 0, paid_out: 0, count: 0, days: new Set(), last: "", partners: new Set(), methods: new Set(), names: new Set() };
    if (p.direction === "out") a.paid_out += Number(p.amount) || 0;
    else { a.paid_in += Number(p.amount) || 0; a.count++; }
    a.days.add(p.business_date);
    if (p.business_date > a.last) a.last = p.business_date;
    a.partners.add(p.partner);
    if (p.method) a.methods.add(p.method);
    if (p.payer_name) a.names.add(p.payer_name);
    agg.set(p.handle_key, a);
  }

  // Game accounts of linked members (the cross-panel view)
  const memberIds = Array.from(new Set((handlesQ.data || []).map((h: any) => h.member_id).filter(Boolean)));
  const accountsByMember = new Map<string, { platform: string; account_number: string }[]>();
  if (memberIds.length) {
    const { data: accts } = await supabaseAdmin.from("player_accounts").select("platform, account_number, member_id").in("member_id", memberIds);
    for (const a of accts || []) {
      const list = accountsByMember.get(a.member_id!) || [];
      list.push({ platform: a.platform, account_number: a.account_number });
      accountsByMember.set(a.member_id!, list);
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const payers = (handlesQ.data || [])
    .map((h: any) => {
      const a = agg.get(h.handle_key);
      return {
        handle_key: h.handle_key,
        display: h.display,
        member_id: h.member_id,
        member: h.member || null,
        game_accounts: h.member_id ? accountsByMember.get(h.member_id) || [] : [],
        names: a ? Array.from(a.names).slice(0, 3) : [],
        paid_in: r2(a?.paid_in || 0),
        paid_out: r2(a?.paid_out || 0),
        payments: a?.count || 0,
        days: a?.days.size || 0,
        last_paid: a?.last || null,
        partners: a ? Array.from(a.partners) : [],
        methods: a ? Array.from(a.methods) : [],
      };
    })
    .filter((p) => p.payments > 0 || p.paid_out > 0)
    .sort((x, y) => y.paid_in - x.paid_in);

  return json({
    today: storeDate(0),
    partners: partnersQ.data || [],
    reconciliation: reconQ.data || [],
    payers,
    uploads: uploadsQ.data || [],
  });
}

/* ---------------- POST: read / import a file ---------------- */

async function readTable(filename: string, content?: string, base64?: string): Promise<unknown[][]> {
  if (typeof base64 === "string") {
    if (/\.xls$/i.test(filename)) throw new Error("Old .xls files can't be read. Export as .xlsx or .csv instead.");
    try {
      return (await readXlsxFile(Buffer.from(base64, "base64"))) as unknown[][];
    } catch {
      throw new Error("Couldn't open this Excel file. Export it as .xlsx or .csv and try again.");
    }
  }
  if (typeof content !== "string") throw new Error("Missing file.");
  return parseCsv(content);
}

export async function POST(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  try {
    const body = (await req.json()) as {
      filename?: string; content?: string; base64?: string;
      partner?: string; partnerName?: string; mapping?: ColumnMap; dryRun?: boolean;
    };
    const { filename } = body;
    if (!filename) return json({ error: "Missing file." }, 400);
    if ((body.base64?.length || 0) > 6_000_000 || (body.content?.length || 0) > 4_000_000) {
      return json({ error: "File is too large (max about 4 MB). Export a shorter date range." }, 400);
    }

    // Partner: an existing one, or a new one by name
    let code = (body.partner || "").trim();
    let partner: { code: string; name: string; column_map: ColumnMap | null } | null = null;
    if (code && code !== "__new") {
      const { data } = await supabaseAdmin.from("payment_partners").select("code, name, column_map").eq("code", code).maybeSingle();
      partner = data as any;
      if (!partner) return json({ error: "Unknown payment partner. Pick one from the list or add a new one." }, 400);
    } else {
      const name = (body.partnerName || "").trim();
      if (!name) return json({ error: "Pick the payment partner this export came from (or type a new partner's name)." }, 400);
      code = slugify(name);
      if (!code) return json({ error: "Partner name needs at least one letter or number." }, 400);
      const { data } = await supabaseAdmin.from("payment_partners").select("code, name, column_map").eq("code", code).maybeSingle();
      partner = (data as any) || { code, name, column_map: null };
    }

    let table: unknown[][];
    try {
      table = await readTable(filename, body.content, body.base64);
    } catch (e: any) {
      return json({ error: e.message }, 400);
    }
    const headerIdx = findHeaderRow(table);
    if (headerIdx < 0) return json({ error: "Couldn't find a header row in this file." }, 400);
    const headers = (table[headerIdx] || []).map((h) => String(h ?? "").trim());

    // Which columns mean what: chosen now > remembered for this partner (if it fits) > guessed
    const saved = partner!.column_map;
    const savedFits = saved && missingRequired(saved, headers).length === 0 && Object.values(saved).every((h) => !h || headers.includes(h));
    let map: ColumnMap = body.mapping && Object.keys(body.mapping).length ? body.mapping : savedFits ? saved! : guessMap(headers);
    map = Object.fromEntries(Object.entries(map).filter(([f, h]) => (PAY_FIELDS as readonly string[]).includes(f) && h && headers.includes(h))) as ColumnMap;
    const mapSource = body.mapping && Object.keys(body.mapping).length ? "chosen" : savedFits ? "remembered" : "guessed";
    const missing = missingRequired(map, headers);

    if (missing.length) {
      return json({
        needsMapping: true, headers, map, mapSource, missing,
        sample: table.slice(headerIdx + 1, headerIdx + 4).map((r) => (r || []).map((c) => (c instanceof Date ? c.toISOString().slice(0, 19).replace("T", " ") : String(c ?? "")))),
        error: `Couldn't tell which column is the ${missing.map((m) => (m === "paid_at" ? "date" : m)).join(" and ")}. Match the columns below.`,
      }, 422);
    }

    const parsed = parsePayments(table, headerIdx, map);
    if (!parsed.rows.length) {
      return json({ needsMapping: true, headers, map, mapSource, missing: [], error: "No payments could be read with these columns. Check the matching below.", warnings: parsed.warnings }, 422);
    }

    const counted = parsed.rows.filter((r) => !(r.status && /fail|declin|cancel|reject|void|pending|revers/i.test(r.status)));
    const sum = (d: "in" | "out") => Math.round(counted.filter((r) => r.direction === d).reduce((s, r) => s + r.amount, 0) * 100) / 100;
    const times = parsed.rows.map((r) => r.paid_at).sort();
    const overview = {
      partner: { code: partner!.code, name: partner!.name, isNew: !saved && !(await partnerExists(partner!.code)) },
      headers, map, mapSource,
      rows: parsed.rows.length,
      total_in: sum("in"), total_out: sum("out"),
      first: times[0], last: times[times.length - 1],
      payers: new Set(parsed.rows.map((r) => (r.payer_handle || r.payer_name || "").toLowerCase()).filter(Boolean)).size,
      preview: parsed.rows.slice(0, 8),
      warnings: parsed.warnings,
    };
    if (body.dryRun) return json({ dryRun: true, ...overview });

    // Import
    await supabaseAdmin.from("payment_partners").upsert({ code: partner!.code, name: partner!.name }, { onConflict: "code", ignoreDuplicates: true });
    await supabaseAdmin.from("payment_partners").update({ column_map: map }).eq("code", partner!.code);

    const { data, error } = await supabaseAdmin.rpc("import_payments", {
      p_partner: partner!.code, p_source_file: filename, p_uploaded_by: ctx.userId, p_rows: parsed.rows,
    });
    if (error) {
      console.error("import_payments error:", error);
      return json({ error: error.message }, 400);
    }
    return json({ success: true, ...overview, preview: undefined, summary: data });
  } catch (e) {
    console.error("payments import: unexpected error:", e);
    return json({ error: "Unexpected server error." }, 500);
  }
}

async function partnerExists(code: string) {
  const { data } = await supabaseAdmin.from("payment_partners").select("code").eq("code", code).maybeSingle();
  return !!data;
}
