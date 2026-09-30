// lib/platformImport.ts
// Parses the game panel's daily report export, e.g.
//   zeusgames—2026-09-29 05_00_00—2026-09-30 04_59_59.csv
// Columns: Account,Name,Total IN,Total OUT,Special Comps,Register,Revert First Charge,
//          Gross Net1,Free Entry,First Charge,Deposit Bonus
// Each account row may be followed by an "online free:,<amount>,," line that belongs to it.

export type ImportRow = {
  account_number: string;
  display_name: string | null;
  total_in: number;
  total_out: number;
  special_comps: number;
  register_amount: number;
  revert_first_charge: number;
  gross_net: number;
  free_entry: number;
  first_charge: number;
  deposit_bonus: number;
  online_free: number;
};

export type ParsedReport = {
  platform: string;
  periodStart: string; // "YYYY-MM-DD HH:MM:SS" (panel local time)
  periodEnd: string;
  rows: ImportRow[];
  warnings: string[];
};

const FILE_RE =
  /^(.+?)[\s—–_-]+(\d{4}-\d{2}-\d{2})[\s_T]+(\d{2})[_:](\d{2})[_:](\d{2})[\s—–_-]+(\d{4}-\d{2}-\d{2})[\s_T]+(\d{2})[_:](\d{2})[_:](\d{2})/;

export function parseFileName(fileName: string) {
  const base = fileName.split(/[\\/]/).pop()!.replace(/\.csv$/i, "").trim();
  const m = base.match(FILE_RE);
  if (!m) return null;
  return {
    platform: m[1].trim().toLowerCase(),
    periodStart: `${m[2]} ${m[3]}:${m[4]}:${m[5]}`,
    periodEnd: `${m[6]} ${m[7]}:${m[8]}:${m[9]}`,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function money(raw: string | undefined, where: string, warnings: string[]): number {
  if (raw == null || raw === "") return 0;
  let s = raw.replace(/[$,\s]/g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    warnings.push(`Couldn't read the number "${raw}" (${where}); treated as 0.`);
    return 0;
  }
  return Math.round((neg ? -n : n) * 100) / 100;
}

const HEADER_MAP: Record<string, keyof ImportRow> = {
  account: "account_number",
  name: "display_name",
  totalin: "total_in",
  totalout: "total_out",
  specialcomps: "special_comps",
  register: "register_amount",
  revertfirstcharge: "revert_first_charge",
  grossnet: "gross_net",
  grossnet1: "gross_net",
  freeentry: "free_entry",
  firstcharge: "first_charge",
  depositbonus: "deposit_bonus",
};

export function parseReport(fileName: string, content: string): ParsedReport {
  const meta = parseFileName(fileName);
  if (!meta) {
    throw new Error(
      `Couldn't read the store and dates from the file name "${fileName}". Upload the file exactly as the game panel saved it (don't rename it).`
    );
  }

  const warnings: string[] = [];
  const lines = content.replace(/^﻿/, "").split(/\r?\n/);

  let headerIdx = -1;
  let cols: (keyof ImportRow | null)[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells[0] && cells[0].toLowerCase() === "account") {
      headerIdx = i;
      cols = cells.map((h) => HEADER_MAP[h.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null);
      break;
    }
  }
  if (headerIdx < 0) {
    const first = splitCsvLine(lines.find((l) => l.trim()) || "")[0]?.replace(/^\uFEFF/, "").toLowerCase();
    if (first === "datetime") {
      throw new Error('This is the by-date summary (one row per date). In the game panel, switch the report to the per-player view — the right file starts with "Account, Name, Total IN".');
    }
    throw new Error('This doesn\'t look like the daily report: no "Account" header row found.');
  }
  if (!cols.includes("total_in")) throw new Error('The report is missing the "Total IN" column.');

  const byAccount = new Map<string, ImportRow>();
  let last: ImportRow | null = null;
  let skipped = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCsvLine(lines[i]);
    const first = (cells[0] || "").trim();
    const lower = first.toLowerCase();

    if (lower.startsWith("online free")) {
      if (last) last.online_free = Math.round((last.online_free + money(cells[1], `line ${i + 1}`, warnings)) * 100) / 100;
      else warnings.push(`Line ${i + 1}: "online free" line with no account above it; skipped.`);
      continue;
    }
    if (!first || /^(total|sum|subtotal)/i.test(first)) { skipped++; continue; }

    const row: ImportRow = {
      account_number: first,
      display_name: null,
      total_in: 0, total_out: 0, special_comps: 0, register_amount: 0, revert_first_charge: 0,
      gross_net: 0, free_entry: 0, first_charge: 0, deposit_bonus: 0, online_free: 0,
    };
    cols.forEach((key, idx) => {
      if (!key || key === "account_number") return;
      if (key === "display_name") { row.display_name = cells[idx] ? cells[idx] : null; return; }
      (row as any)[key] = money(cells[idx], `account ${first}`, warnings);
    });

    const existing = byAccount.get(first);
    if (existing) {
      warnings.push(`Account ${first} appears more than once in the file; its amounts were added together.`);
      for (const k of Object.keys(row) as (keyof ImportRow)[]) {
        if (typeof row[k] === "number") (existing as any)[k] = Math.round(((existing as any)[k] + (row as any)[k]) * 100) / 100;
      }
      last = existing;
    } else {
      byAccount.set(first, row);
      last = row;
    }
  }
  if (skipped) warnings.push(`${skipped} line(s) that weren't player rows (e.g. totals) were skipped.`);

  return { ...meta, rows: Array.from(byAccount.values()), warnings };
}
