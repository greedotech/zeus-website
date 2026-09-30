// app/api/host/import/batches/route.ts
// GET -> upload history (last 60 days) + missing / partial business days.
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

const TZ = "America/New_York";
const REMIND_AFTER_HOUR = 14; // yesterday's file counts as "missing" only after 2 PM

function nowInStore() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

function addDays(d: string, n: number) {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { ctx, response } = await requireHost(req);
  if (!ctx) return response!;

  const now = nowInStore();
  // Business day D runs D 5:00 AM -> D+1 4:59 AM, so "yesterday" is the newest finished day.
  const newestExpected = addDays(now.date, now.hour >= REMIND_AFTER_HOUR ? -1 : -2);
  const since = addDays(now.date, -60);

  const { data, error } = await supabaseAdmin
    .from("platform_import_batches")
    .select(
      "id, platform, kind, business_date, period_start, period_end, is_complete, account_count, total_in, total_out, gross_net, new_rows, skipped_rows, source_file, uploaded_at, uploader:profiles!platform_import_batches_uploaded_by_fkey(username, first_name)"
    )
    .gte("business_date", since)
    .order("uploaded_at", { ascending: false })
    .limit(500);
  if (error) return json({ error: error.message }, 500);

  // Latest daily-report upload per platform + day (transaction uploads are listed separately:
  // a day with no deposits is normal for them, so they aren't checked for missing days)
  const latest = new Map<string, any>();
  for (const b of (data || []).filter((x: any) => x.kind !== "transactions")) {
    const k = `${b.platform}|${b.business_date}`;
    if (!latest.has(k)) latest.set(k, b);
  }

  const platforms = Array.from(new Set(Array.from(latest.values()).map((b) => b.platform)));
  const issues: { platform: string; business_date: string; problem: "missing" | "partial" }[] = [];
  for (const p of platforms) {
    const days = Array.from(latest.values()).filter((b) => b.platform === p).map((b) => b.business_date).sort();
    if (!days.length) continue;
    for (let d = days[0]; d <= newestExpected; d = addDays(d, 1)) {
      const b = latest.get(`${p}|${d}`);
      if (!b) issues.push({ platform: p, business_date: d, problem: "missing" });
      else if (!b.is_complete) issues.push({ platform: p, business_date: d, problem: "partial" });
    }
  }
  issues.sort((a, b) => (a.business_date < b.business_date ? 1 : -1));

  return json({
    today: now.date,
    days: Array.from(latest.values()).sort((a, b) => (a.business_date < b.business_date ? 1 : -1)),
    transactionUploads: (data || []).filter((x: any) => x.kind === "transactions").slice(0, 20),
    uploads: data || [],
    issues,
  });
}
