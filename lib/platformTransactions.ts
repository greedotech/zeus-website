// lib/platformTransactions.ts
// Reads per-transaction top-up exports (e.g. the Zeusgames2 agent panel for Dragon Fury + SLOTMANIA):
//   Order number | User account | Account deposited | Type | Topup point | Points before | Points after |
//   Record time | Point topup status | Description | Operator | Operator IP
// Each row is one deposit (or withdrawal). The order number is the unique key, so re-uploads never duplicate.

export type TxnRow = {
  order_number: string;
  account_number: string;
  txn_type: string | null;
  direction: "in" | "out";
  amount: number;
  points_before: number | null;
  points_after: number | null;
  recorded_at: string; // "YYYY-MM-DD HH:MM:SS" (panel time, stored as-is)
  status: string | null;
  operator: string | null;
  description: string | null;
};

export type ParsedTxns = { platform: string; rows: TxnRow[]; warnings: string[] };

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADERS = {
  order: ["ordernumber", "orderno", "orderid"],
  agent: ["useraccount", "agentaccount"],
  player: ["accountdeposited", "playeraccount", "username", "account"],
  type: ["type"],
  amount: ["topuppoint", "amount", "points"],
  before: ["pointsbefore"],
  after: ["pointsafter"],
  time: ["recordtime", "time", "datetime"],
  status: ["pointtopupstatus", "status"],
  description: ["description", "remark", "remarks"],
  operator: ["operator"],
};

export function looksLikeTransactions(header: unknown[]): boolean {
  const h = header.map(norm);
  return h.includes("ordernumber") && (h.includes("accountdeposited") || h.includes("playeraccount")) && h.some((x) => HEADERS.amount.includes(x));
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toTimestamp(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Excel stores wall-clock time; the reader returns it in the UTC fields.
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
  }
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${pad(+m[2])}-${pad(+m[3])} ${pad(+m[4])}:${m[5]}:${m[6] ?? "00"}`;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const OUT_TYPES = /withdraw|redeem|cash\s*out|deduct|agentdel|minus/i;

export function parseTransactions(table: unknown[][]): ParsedTxns {
  const warnings: string[] = [];
  const headerIdx = table.findIndex((r) => looksLikeTransactions(r));
  if (headerIdx < 0) throw new Error("This Excel file isn't a top-up record export (no \"Order number\" / \"Account deposited\" columns).");

  const header = table[headerIdx].map(norm);
  const col = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const c = {
    order: col(HEADERS.order), agent: col(HEADERS.agent), player: col(HEADERS.player), type: col(HEADERS.type),
    amount: col(HEADERS.amount), before: col(HEADERS.before), after: col(HEADERS.after), time: col(HEADERS.time),
    status: col(HEADERS.status), description: col(HEADERS.description), operator: col(HEADERS.operator),
  };
  if (c.time < 0) throw new Error('The export is missing the "Record time" column.');

  let platform = "";
  const rows: TxnRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = headerIdx + 1; i < table.length; i++) {
    const r = table[i] || [];
    const orderRaw = r[c.order];
    if (orderRaw === null || orderRaw === undefined || String(orderRaw).trim() === "") continue;
    if (typeof orderRaw === "number" && !Number.isSafeInteger(orderRaw)) {
      warnings.push(`Row ${i + 1}: order number was stored as a rounded number in Excel; it may not be unique.`);
    }
    const order = String(orderRaw).trim();
    const player = String(r[c.player] ?? "").trim();
    const amt = num(r[c.amount]);
    const ts = toTimestamp(r[c.time]);
    if (!player || amt === null || !ts) {
      skipped++;
      continue;
    }
    if (!platform && c.agent >= 0 && r[c.agent]) platform = String(r[c.agent]).trim().toLowerCase();
    if (seen.has(order)) { warnings.push(`Order ${order} appears twice in the file; counted once.`); continue; }
    seen.add(order);

    const type = c.type >= 0 && r[c.type] != null ? String(r[c.type]).trim() : null;
    const out = amt < 0 || (type ? OUT_TYPES.test(type) : false);
    rows.push({
      order_number: order,
      account_number: player,
      txn_type: type,
      direction: out ? "out" : "in",
      amount: Math.round(Math.abs(amt) * 100) / 100,
      points_before: c.before >= 0 ? num(r[c.before]) : null,
      points_after: c.after >= 0 ? num(r[c.after]) : null,
      recorded_at: ts,
      status: c.status >= 0 && r[c.status] != null ? String(r[c.status]).trim() : null,
      operator: c.operator >= 0 && r[c.operator] != null ? String(r[c.operator]).trim() : null,
      description: c.description >= 0 && r[c.description] != null ? String(r[c.description]).trim() : null,
    });
  }

  if (!platform) throw new Error('Couldn\'t find the agent account ("User account" column) in the file.');
  if (skipped) warnings.push(`${skipped} row(s) without a player, amount, or time were skipped.`);
  const failed = rows.filter((x) => x.status && !/success/i.test(x.status)).length;
  if (failed) warnings.push(`${failed} row(s) are not marked "success"; they're saved but left out of reports.`);
  return { platform, rows, warnings };
}
