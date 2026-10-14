// lib/paymentsImport.ts
// Reads payment-partner exports (CSV or Excel) of any layout.
// Each partner's columns are matched by name (auto-guess), or by a mapping the host picks once and is remembered.
// Output rows go to the import_payments() database function; the transaction ID is the unique key, so
// re-uploading overlapping exports never double-counts.

import { createHash } from "crypto";

export const PAY_FIELDS = [
  "external_id", "paid_at", "paid_time", "amount", "fee", "direction",
  "payer_name", "payer_handle", "method", "status", "note",
] as const;
export type PayField = (typeof PAY_FIELDS)[number];
export type ColumnMap = Partial<Record<PayField, string>>; // field -> header text as it appears in the file

export const FIELD_LABELS: Record<PayField, string> = {
  external_id: "Transaction ID",
  paid_at: "Date / time",
  paid_time: "Time (if separate)",
  amount: "Amount",
  fee: "Fee",
  direction: "Type (payment / refund)",
  payer_name: "Payer name",
  payer_handle: "Payer handle / tag",
  method: "Method / app",
  status: "Status",
  note: "Note / memo",
};

export type PaymentRow = {
  external_id: string;
  paid_at: string; // "YYYY-MM-DD HH:MM:SS", store-local (America/New_York)
  direction: "in" | "out";
  amount: number;
  fee: number | null;
  method: string | null;
  payer_name: string | null;
  payer_handle: string | null;
  status: string | null;
  note: string | null;
};

const TZ = "America/New_York";
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Header synonyms (normalized). First match wins, in this order.
const SYNONYMS: Record<PayField, string[]> = {
  external_id: ["transactionid", "txnid", "transid", "paymentid", "referenceid", "reference", "referencenumber", "refno", "ref",
    "confirmationnumber", "confirmation", "confirmationcode", "orderid", "ordernumber", "id", "transactionnumber"],
  paid_at: ["datetime", "dateandtime", "transactiondate", "transactiondatetime", "paymentdate", "createdat", "created",
    "createddate", "completedat", "completed", "timestamp", "date", "processeddate", "settleddate", "time"],
  paid_time: ["time", "transactiontime", "paymenttime"],
  amount: ["amount", "grossamount", "gross", "grosssales", "amountusd", "totalcollected", "amountmoney", "sales", "paymentamount", "total", "totalamount", "netamount", "net", "value"],
  fee: ["fee", "fees", "processingfee", "feeamount"],
  direction: ["transactiontype", "type", "direction", "paymenttype", "kind", "category", "description"],
  payer_name: ["payername", "sendername", "nameofsenderreceiver", "customername", "customer", "name", "from", "sender",
    "payer", "counterparty", "counterpartyname", "fullname", "player", "playername"],
  payer_handle: ["cashtag", "handle", "payerhandle", "senderhandle", "tag", "username", "senderusername",
    "payeraccount", "senderaccount", "fromaccount", "account", "accountname", "playerid", "customerid"],
  method: ["method", "paymentmethod", "source", "channel", "app", "platform", "paymentapp", "network", "fundingsource", "instrument"],
  status: ["status", "transactionstatus", "paymentstatus", "state"],
  note: ["notes", "note", "memo", "message", "comment", "comments", "remark", "remarks", "for"],
};

const REQUIRED: PayField[] = ["paid_at", "amount"];

export function guessMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<number>();
  const n = headers.map(norm);
  for (const f of PAY_FIELDS) {
    for (const syn of SYNONYMS[f]) {
      const i = n.findIndex((h, idx) => !used.has(idx) && h === syn);
      if (i >= 0) { map[f] = headers[i]; used.add(i); break; }
    }
  }
  // Loose second pass for the important fields ("Amount ($)", "Transaction Date (EST)", ...)
  for (const f of ["amount", "paid_at", "external_id"] as PayField[]) {
    if (map[f]) continue;
    const keys = f === "amount" ? ["amount", "gross", "total", "sales"] : f === "paid_at" ? ["date"] : ["transactionid", "reference"];
    const i = n.findIndex((h, idx) => !used.has(idx) && keys.some((k) => h.includes(k)));
    if (i >= 0) { map[f] = headers[i]; used.add(i); }
  }
  // A "Time" column only means a separate time if the date column is date-only
  if (map.paid_time && map.paid_time === map.paid_at) delete map.paid_time;
  return map;
}

export function missingRequired(map: ColumnMap, headers: string[]): PayField[] {
  return REQUIRED.filter((f) => !map[f] || !headers.includes(map[f]!));
}

/* ---------- reading files ---------- */

export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  // Pick the delimiter that appears most on the first line
  const first = s.split(/\r?\n/, 1)[0] || "";
  const delim = [",", ";", "\t", "|"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// The header row is the first of the top 15 rows that names a date-ish and an amount-ish column.
export function findHeaderRow(table: unknown[][]): number {
  for (let i = 0; i < Math.min(15, table.length); i++) {
    const n = (table[i] || []).map(norm);
    const hasDate = n.some((h) => /date|time|created|completed/.test(h));
    const hasAmt = n.some((h) => /amount|gross|total|net|value/.test(h));
    if (hasDate && hasAmt) return i;
  }
  return table.findIndex((r) => (r || []).filter((c) => String(c ?? "").trim() !== "").length >= 3);
}

/* ---------- values ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const monthOf = (w: string) => MONTHS[w.toLowerCase().slice(0, 4)] || MONTHS[w.toLowerCase().slice(0, 3)] || 0;
const ZONES: Record<string, number> = { utc: 0, gmt: 0, z: 0, est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420 };

function toStoreTime(utcMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")} ${pad(Number(g("hour")) % 24)}:${g("minute")}:${g("second")}`;
}

// Returns store-local wall time, or null. Wall times with no zone are taken as already store-local.
export function parseWhen(v: unknown, timePart?: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Excel stores wall-clock time; the reader puts it in the UTC fields.
    let h = v.getUTCHours(), mi = v.getUTCMinutes(), se = v.getUTCSeconds();
    if (timePart !== undefined && h === 0 && mi === 0) {
      const t = parseClock(timePart);
      if (t) [h, mi, se] = t;
    }
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(h)}:${pad(mi)}:${pad(se)}`;
  }
  let s = String(v ?? "").trim();
  if (!s) return null;
  if (timePart !== undefined && timePart !== null && String(timePart).trim() && !/\d:\d\d/.test(s)) {
    s += " " + (timePart instanceof Date ? `${timePart.getUTCHours()}:${pad(timePart.getUTCMinutes())}` : String(timePart).trim());
  }
  s = s.replace(/\s+at\s+/i, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();

  let y = 0, mo = 0, d = 0;
  let rest = "";
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[T ]?(.*)$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\s*(.*)$/))) { mo = +m[1]; d = +m[2]; y = +m[3]; rest = m[4]; }
  else if ((m = s.match(/^(?:[a-z]{3,9}\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})\s*(.*)$/i)) && monthOf(m[1])) {
    mo = monthOf(m[1]); d = +m[2]; y = +m[3]; rest = m[4];
  } else if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})\s*(.*)$/i)) && monthOf(m[2])) {
    d = +m[1]; mo = monthOf(m[2]); y = +m[3]; rest = m[4];
  } else if (/^\d{10}(\d{3})?$/.test(s)) {
    const ms = s.length === 13 ? +s : +s * 1000;
    return toStoreTime(ms);
  } else return null;
  if (y < 100) y += 2000;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;

  let h = 0, mi = 0, se = 0;
  let offsetMin: number | null = null;
  rest = rest.trim();
  const tm = rest.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(am|pm|a\.m\.|p\.m\.)?\s*(.*)$/i);
  if (tm) {
    h = +tm[1]; mi = +tm[2]; se = tm[3] ? +tm[3] : 0;
    const ap = (tm[4] || "").toLowerCase().replace(/\./g, "");
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const zone = (tm[5] || "").trim();
    const zm = zone.match(/^(?:utc|gmt)?\s*([+-])(\d{1,2}):?(\d{2})?$/i);
    if (zone.toUpperCase() === "Z") offsetMin = 0;
    else if (zm) offsetMin = (zm[1] === "-" ? -1 : 1) * (+zm[2] * 60 + (zm[3] ? +zm[3] : 0));
    else if (ZONES[zone.toLowerCase().replace(/[()]/g, "")] !== undefined) offsetMin = ZONES[zone.toLowerCase().replace(/[()]/g, "")];
  }
  if (h > 23 || mi > 59 || se > 59) return null;
  if (offsetMin === null) return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(se)}`;
  const utc = Date.UTC(y, mo - 1, d, h, mi, se) - offsetMin * 60_000;
  return toStoreTime(utc);
}

function parseClock(v: unknown): [number, number, number] | null {
  if (v instanceof Date) return [v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds()];
  const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  if (m[4]?.toLowerCase() === "pm" && h < 12) h += 12;
  if (m[4]?.toLowerCase() === "am" && h === 12) h = 0;
  return [h, +m[2], m[3] ? +m[3] : 0];
}

export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^-|\s-|-\s*\$|^\$\s*-/.test(s) || /-$/.test(s)) neg = true;
  s = s.replace(/usd|\$|,|\s|\+|-/gi, "");
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

const OUT_WORDS = /refund|payout|pay\s*out|withdraw|sent|send|debit|cash\s*out|transfer\s*out|outgoing|chargeback|charge\s*back|reversal|reversed|redeem|redemption/i;
const IN_WORDS = /receiv|deposit|credit|incoming|sale|charge|payment\s*in|load|top\s*up|purchase/i;

const str = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = v instanceof Date ? v.toISOString() : String(v).trim();
  return s === "" ? null : s;
};

export type ParsedPayments = { rows: PaymentRow[]; warnings: string[] };

export function parsePayments(table: unknown[][], headerIdx: number, map: ColumnMap): ParsedPayments {
  const headers = (table[headerIdx] || []).map((h) => String(h ?? "").trim());
  const col = (f: PayField) => (map[f] ? headers.indexOf(map[f]!) : -1);
  const c = Object.fromEntries(PAY_FIELDS.map((f) => [f, col(f)])) as Record<PayField, number>;
  const warnings: string[] = [];
  const rows: PaymentRow[] = [];
  const seen = new Map<string, number>();
  let skipped = 0, autoIds = 0, zeroes = 0;

  for (let i = headerIdx + 1; i < table.length; i++) {
    const r = table[i] || [];
    const get = (f: PayField) => (c[f] >= 0 ? r[c[f]] : undefined);
    const whenRaw = get("paid_at");
    const amtRaw = get("amount");
    if ((whenRaw === null || whenRaw === undefined || String(whenRaw).trim() === "") && (amtRaw === null || amtRaw === undefined || String(amtRaw).trim() === "")) continue;
    // Skip repeated header / total lines
    if (/^total|^sum|^grand/i.test(String(r[0] ?? ""))) continue;

    const paid_at = parseWhen(whenRaw, c.paid_time >= 0 ? get("paid_time") : undefined);
    const amt = parseMoney(amtRaw);
    if (!paid_at || amt === null) { skipped++; continue; }
    if (amt === 0) { zeroes++; continue; }

    const typeText = str(get("direction")) || "";
    const out = amt < 0 || (OUT_WORDS.test(typeText) && !IN_WORDS.test(typeText.replace(OUT_WORDS, "")));
    const payer_name = str(get("payer_name"));
    const payer_handle = str(get("payer_handle"));

    let id = str(get("external_id"));
    if (!id) {
      const base = `${paid_at}|${Math.abs(amt)}|${out ? "out" : "in"}|${(payer_handle || payer_name || "").toLowerCase()}`;
      const k = (seen.get(base) || 0) + 1;
      seen.set(base, k);
      id = "auto:" + createHash("sha1").update(`${base}|${k}`).digest("hex").slice(0, 20);
      autoIds++;
    } else if (seen.has(`id:${id}`)) {
      warnings.push(`Transaction ${id} appears twice in the file; counted once.`);
      continue;
    } else seen.set(`id:${id}`, 1);

    const fee = parseMoney(get("fee"));
    rows.push({
      external_id: id,
      paid_at,
      direction: out ? "out" : "in",
      amount: Math.round(Math.abs(amt) * 100) / 100,
      fee: fee === null ? null : Math.round(Math.abs(fee) * 100) / 100,
      method: str(get("method")),
      payer_name,
      payer_handle,
      status: str(get("status")),
      note: str(get("note")),
    });
  }

  if (skipped) warnings.push(`${skipped} row(s) had a date or amount that couldn't be read and were skipped.`);
  if (zeroes) warnings.push(`${zeroes} row(s) with a $0 amount were skipped.`);
  if (autoIds) warnings.push(`This export has no transaction ID column, so rows are matched by time + amount + payer to avoid duplicates.`);
  if (c.payer_name < 0 && c.payer_handle < 0) warnings.push("No payer name or handle column was found, so payments can't be tied to players. Pick one with \"Change columns\" if the file has it.");
  const notCounted = rows.filter((x) => x.status && /fail|declin|cancel|reject|void|pending|revers/i.test(x.status)).length;
  if (notCounted) warnings.push(`${notCounted} payment(s) are failed, pending or cancelled; they're saved but not counted as money in.`);
  return { rows, warnings };
}

export function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}
