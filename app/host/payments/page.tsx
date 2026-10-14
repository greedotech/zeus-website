"use client";

// Payments — part of the Host Console.
// Hosts upload payment-partner exports, compare money received with points loaded on the game panels
// (per business day, 5:00 AM -> 4:59 AM), and tie payers to members so one player is one player across all games.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Field =
  | "external_id" | "paid_at" | "paid_time" | "amount" | "fee" | "direction"
  | "payer_name" | "payer_handle" | "method" | "status" | "note";
type ColumnMap = Partial<Record<Field, string>>;

const FIELDS: { f: Field; label: string; hint?: string; required?: boolean }[] = [
  { f: "paid_at", label: "Date / time", required: true },
  { f: "amount", label: "Amount", required: true },
  { f: "external_id", label: "Transaction ID", hint: "stops duplicates on re-upload" },
  { f: "payer_handle", label: "Payer handle / tag", hint: "ties payments to players" },
  { f: "payer_name", label: "Payer name" },
  { f: "direction", label: "Type", hint: "tells payments from refunds" },
  { f: "status", label: "Status", hint: "failed / pending aren't counted" },
  { f: "method", label: "Method / app" },
  { f: "fee", label: "Fee" },
  { f: "paid_time", label: "Time (if separate)" },
  { f: "note", label: "Note / memo" },
];

type Partner = { code: string; name: string; column_map: ColumnMap | null };
type ReconDay = {
  business_date: string; paid_in: number; paid_out: number; payment_count: number; payers: number;
  loaded: number; redeemed: number; load_count: number; panels_uploaded: number; partners_uploaded: number; gap: number;
};
type MemberHit = { id: string; username: string | null; first_name: string | null; last_name: string | null; email: string | null };
type Payer = {
  handle_key: string; display: string; member_id: string | null; member: MemberHit | null;
  game_accounts: { platform: string; account_number: string }[];
  names: string[]; paid_in: number; paid_out: number; payments: number; days: number; last_paid: string | null;
  partners: string[]; methods: string[];
};
type Upload = {
  id: string; platform: string; period_start: string; period_end: string; account_count: number;
  total_in: number; total_out: number; new_rows: number | null; skipped_rows: number | null; source_file: string | null;
  uploaded_at: string; uploader?: { username: string | null; first_name: string | null } | null;
};
type PreviewRow = {
  external_id: string; paid_at: string; direction: "in" | "out"; amount: number; payer_name: string | null;
  payer_handle: string | null; method: string | null; status: string | null;
};
type ReadResult = {
  headers: string[]; map: ColumnMap; mapSource: "chosen" | "remembered" | "guessed";
  rows?: number; total_in?: number; total_out?: number; first?: string; last?: string; payers?: number;
  preview?: PreviewRow[]; warnings?: string[]; missing?: Field[]; sample?: string[][]; error?: string;
  partner?: { code: string; name: string; isNew: boolean };
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No active session. Please log in again.");
  return token;
}

class ApiError extends Error { body: any; status: number; constructor(m: string, s: number, b: any) { super(m); this.status = s; this.body = b; } }

async function api(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body);
  return body;
}

async function fileToBase64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const money = (n: number | string | null | undefined) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const shortTime = (ts: string) =>
  new Date(ts.replace(" ", "T")).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const memberLabel = (m?: MemberHit | null) =>
  !m ? "" : ([m.first_name, m.last_name].filter(Boolean).join(" ") + (m.username ? ` (@${m.username})` : "")).trim() || m.email || m.id;

const S = {
  page: { minHeight: "100vh", background: "#000", color: "#e5e7eb", padding: "96px 16px 60px" } as React.CSSProperties,
  wrap: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 } as React.CSSProperties,
  card: { background: "rgba(15,23,42,0.85)", border: "1px solid #374151", borderRadius: 16, padding: 20 } as React.CSSProperties,
  h1: { fontFamily: "var(--font-cinzel), serif", fontSize: "1.8rem", margin: 0, color: "#fbbf24" } as React.CSSProperties,
  h2: { margin: "0 0 12px", fontSize: 16, fontFamily: "var(--font-cinzel), serif", color: "#fde68a" } as React.CSSProperties,
  btn: { padding: "9px 14px", borderRadius: 10, border: "none", background: "#facc15", color: "#000", fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  btnGhost: { padding: "6px 10px", borderRadius: 8, border: "1px solid #4b5563", background: "transparent", color: "#e5e7eb", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  input: { padding: "7px 10px", borderRadius: 8, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb", fontSize: 14 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 } as React.CSSProperties,
  th: { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #374151", color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" } as React.CSSProperties,
  td: { padding: "8px 6px", borderBottom: "1px solid #1f2937", verticalAlign: "top" } as React.CSSProperties,
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as React.CSSProperties,
  ok: { color: "#86efac" } as React.CSSProperties,
  bad: { color: "#fca5a5" } as React.CSSProperties,
  warn: { color: "#fcd34d" } as React.CSSProperties,
  muted: { color: "#9ca3af", fontSize: 13 } as React.CSSProperties,
  tile: { background: "rgba(2,6,23,0.7)", border: "1px solid #1f2937", borderRadius: 12, padding: "12px 14px" } as React.CSSProperties,
  tileNum: { fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#f9fafb" } as React.CSSProperties,
};

function dayStatus(d: ReconDay): { tone: "ok" | "warn" | "bad" | "muted"; text: string } {
  const gap = Number(d.gap);
  const tol = Math.max(1, Number(d.paid_in) * 0.01);
  if (!d.partners_uploaded && d.panels_uploaded) return { tone: "muted", text: "No payment export uploaded for this day" };
  if (d.partners_uploaded && !d.panels_uploaded) return { tone: "muted", text: "No game panel reports uploaded for this day" };
  if (Math.abs(gap) <= tol) return { tone: "ok", text: "Matches" };
  if (gap < 0) return { tone: "bad", text: `${money(-gap)} loaded with no payment behind it — check` };
  return { tone: "warn", text: `${money(gap)} paid but not seen on uploaded panels` };
}

function PayerLink({ payer, onDone }: { payer: Payer; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setBusy(true); setErr(null); setHits(null);
    try {
      const body = q.includes("@") ? { email: q.trim() } : { username: q.trim() };
      const r = await api("/api/host/get-user", { method: "POST", body: JSON.stringify(body) });
      setHits(r.users || []);
    } catch (e: any) {
      setErr(e.message === "No user found." ? "No member found." : e.message);
    } finally { setBusy(false); }
  }

  async function link(member_id: string | null) {
    setBusy(true); setErr(null);
    try {
      await api("/api/host/payments/link", { method: "POST", body: JSON.stringify({ handle_key: payer.handle_key, member_id }) });
      setHits(null); setQ("");
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (payer.member_id) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={S.ok}>{memberLabel(payer.member)}</span>
          <button style={S.btnGhost} disabled={busy} onClick={() => link(null)}>Unlink</button>
        </div>
        <div style={S.muted}>
          {payer.game_accounts.length
            ? `Game accounts: ${payer.game_accounts.map((a) => `${a.account_number} (${a.platform})`).join(", ")}`
            : "No game accounts linked to this member yet"}
        </div>
        {err && <span style={S.bad}>{err}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input style={{ ...S.input, width: 180 }} placeholder="Member username or email" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        <button style={S.btnGhost} disabled={busy} onClick={search}>{busy ? "…" : "Find"}</button>
      </div>
      {hits && hits.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          {hits.slice(0, 6).map((m) => (
            <button key={m.id} style={{ ...S.btnGhost, textAlign: "left" }} disabled={busy} onClick={() => link(m.id)}>
              Link → {memberLabel(m)}{m.email ? ` · ${m.email}` : ""}
            </button>
          ))}
        </div>
      )}
      {err && <span style={S.bad}>{err}</span>}
    </div>
  );
}

function UndoButton({ upload, onDone }: { upload: Upload; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function undo() {
    setBusy(true); setErr(null);
    try {
      await api(`/api/host/payments/batch?id=${encodeURIComponent(upload.id)}`, { method: "DELETE" });
      onDone();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  if (!confirming) return <button style={S.btnGhost} onClick={() => setConfirming(true)}>Undo</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={S.warn}>Remove {upload.new_rows ?? 0} payment(s)?</span>
      <button style={{ ...S.btnGhost, borderColor: "#f87171", color: "#fca5a5" }} disabled={busy} onClick={undo}>{busy ? "…" : "Yes, remove"}</button>
      <button style={S.btnGhost} disabled={busy} onClick={() => setConfirming(false)}>Keep</button>
      {err && <span style={S.bad}>{err}</span>}
    </span>
  );
}

export default function HostPaymentsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [recon, setRecon] = useState<ReconDay[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [partner, setPartner] = useState<string>("");
  const [partnerName, setPartnerName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<ColumnMap | null>(null);
  const [read, setRead] = useState<ReadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; warnings?: string[] } | null>(null);
  const [payerFilter, setPayerFilter] = useState<"all" | "unlinked">("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) { router.replace("/login"); return; }
        const { data } = await supabase.from("profiles").select("is_host").eq("id", authData.user.id).maybeSingle();
        if (!mounted) return;
        if (!data?.is_host) setAccessError("You do not have access to the Host Console.");
        setChecking(false);
      } catch (e: any) {
        if (!mounted) return;
        setAccessError(e?.message || "Unable to verify host permissions.");
        setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  const refresh = useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await api("/api/host/payments?days=45");
      setPartners(r.partners || []);
      setRecon(r.reconciliation || []);
      setPayers(r.payers || []);
      setUploads(r.uploads || []);
      setPartner((p) => p || (r.partners?.length ? r.partners[0].code : "__new"));
    } catch (e: any) { setLoadErr(e.message); }
  }, []);
  useEffect(() => { if (!checking && !accessError) refresh(); }, [checking, accessError, refresh]);

  async function payload(extra: Record<string, unknown>) {
    if (!file) throw new Error("Choose a file first.");
    const isExcel = /\.xlsx?$/i.test(file.name);
    return {
      filename: file.name,
      ...(isExcel ? { base64: await fileToBase64(file) } : { content: await file.text() }),
      partner, partnerName: partner === "__new" ? partnerName : undefined,
      ...extra,
    };
  }

  async function readFile(withMapping?: ColumnMap | null) {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/api/host/payments", { method: "POST", body: JSON.stringify(await payload({ dryRun: true, mapping: withMapping || undefined })) });
      setRead(r); setMapping(r.map);
    } catch (e: any) {
      if (e instanceof ApiError && e.body?.needsMapping) { setRead(e.body); setMapping(e.body.map || {}); }
      else { setRead(null); setMsg({ ok: false, text: e.message }); }
    } finally { setBusy(false); }
  }

  async function doImport() {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/api/host/payments", { method: "POST", body: JSON.stringify(await payload({ mapping })) });
      const s = r.summary;
      setMsg({
        ok: true,
        text: `${r.partner.name} · ${s.new_rows} new payment(s)` + (s.skipped_rows ? `, ${s.skipped_rows} already uploaded` : "") +
          ` · ${shortTime(s.first)} → ${shortTime(s.last)} · in ${money(s.total_in)}` + (Number(s.total_out) ? ` · refunds/payouts ${money(s.total_out)}` : "") +
          ` · ${s.payers} payer(s)` + (s.new_payers ? ` (${s.new_payers} new)` : ""),
        warnings: r.warnings,
      });
      setRead(null); setFile(null); setMapping(null);
      const input = document.getElementById("pay-file") as HTMLInputElement | null;
      if (input) input.value = "";
      if (partner === "__new") { setPartner(r.partner.code); setPartnerName(""); }
      refresh();
    } catch (e: any) {
      if (e instanceof ApiError && e.body?.needsMapping) { setRead(e.body); setMapping(e.body.map || {}); }
      else setMsg({ ok: false, text: e.message });
    } finally { setBusy(false); }
  }

  const activeDays = useMemo(() => recon.filter((d) => Number(d.paid_in) || Number(d.loaded) || Number(d.paid_out)), [recon]);
  const last7 = useMemo(() => activeDays.slice(0, 7), [activeDays]);
  const tiles = useMemo(() => {
    const both = last7.filter((d) => d.partners_uploaded && d.panels_uploaded);
    return {
      paid: last7.reduce((s, d) => s + Number(d.paid_in), 0),
      loaded: last7.reduce((s, d) => s + Number(d.loaded), 0),
      gap: both.reduce((s, d) => s + Number(d.gap), 0),
      flagged: both.filter((d) => dayStatus(d).tone === "bad").length,
      payers: payers.length,
      linked: payers.filter((p) => p.member_id).length,
    };
  }, [last7, payers]);

  if (checking) return <main style={S.page}><div style={S.wrap}>Checking access…</div></main>;
  if (accessError) return <main style={S.page}><div style={S.wrap}><p style={S.bad}>{accessError}</p></div></main>;

  const shownPayers = payerFilter === "unlinked" ? payers.filter((p) => !p.member_id) : payers;
  const canRead = !!file && (partner !== "__new" || partnerName.trim().length > 0);

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h1 style={S.h1}>Payments</h1>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/host/import" style={{ color: "#93c5fd", textDecoration: "underline" }}>Daily game reports</Link>
            <Link href="/host" style={{ color: "#93c5fd", textDecoration: "underline" }}>← Host Console</Link>
          </div>
        </div>

        {/* Summary */}
        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div style={S.tile}><div style={S.muted}>Money in (last {last7.length || 7} active days)</div><div style={S.tileNum}>{money(tiles.paid)}</div></div>
          <div style={S.tile}><div style={S.muted}>Points loaded (uploaded panels)</div><div style={S.tileNum}>{money(tiles.loaded)}</div></div>
          <div style={S.tile}>
            <div style={S.muted}>Difference on fully uploaded days</div>
            <div style={{ ...S.tileNum, ...(Math.abs(tiles.gap) < 1 ? S.ok : tiles.gap < 0 ? S.bad : S.warn) }}>{money(tiles.gap)}</div>
          </div>
          <div style={S.tile}><div style={S.muted}>Days to check</div><div style={{ ...S.tileNum, ...(tiles.flagged ? S.bad : S.ok) }}>{tiles.flagged}</div></div>
          <div style={S.tile}><div style={S.muted}>Payers tied to members</div><div style={S.tileNum}>{tiles.linked} / {tiles.payers}</div></div>
        </section>

        {/* 1. Upload */}
        <section style={S.card}>
          <h2 style={S.h2}>1. Upload a payment partner export</h2>
          <ol style={{ margin: "0 0 14px", paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
            <li>From the partner&apos;s portal, export transactions for <b>yesterday 5:00 AM → today 4:59 AM</b> (or a whole day / week — overlaps are fine) as <b>CSV or Excel (.xlsx)</b>.</li>
            <li>Pick the partner, choose the file and press <b>Read file</b>. Check the columns were matched correctly, then press <b>Import</b>.</li>
            <li>The column matching is remembered per partner, so after the first time it&apos;s just Read → Import. Payments with a known transaction ID are skipped, never counted twice.</li>
          </ol>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={partner} onChange={(e) => { setPartner(e.target.value); setRead(null); setMapping(null); }} style={S.input}>
              {partners.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              <option value="__new">+ New payment partner…</option>
            </select>
            {partner === "__new" && (
              <input style={{ ...S.input, width: 200 }} placeholder="Partner name" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
            )}
            <input id="pay-file" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setRead(null); setMapping(null); setMsg(null); }} style={{ color: "#e5e7eb" }} />
            <button style={S.btn} disabled={!canRead || busy} onClick={() => readFile(null)}>{busy && !read ? "Reading…" : "Read file"}</button>
          </div>

          {read && (
            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {read.error && <div style={S.warn}>{read.error}</div>}
              {!read.error && read.rows !== undefined && (
                <div style={{ fontSize: 14 }}>
                  <b>{read.rows}</b> payment(s) · {read.first ? `${shortTime(read.first)} → ${shortTime(read.last!)}` : ""} · in <b>{money(read.total_in)}</b>
                  {Number(read.total_out) ? <> · refunds/payouts <b>{money(read.total_out)}</b></> : null} · {read.payers} payer(s)
                  <span style={{ ...S.muted, marginLeft: 8 }}>
                    {read.mapSource === "remembered" ? "Columns matched the way you set them last time." : read.mapSource === "guessed" ? "Columns matched automatically — check below." : "Using the columns you picked."}
                  </span>
                </div>
              )}

              <div>
                <div style={{ ...S.muted, marginBottom: 6 }}>Which column holds what</div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                  {FIELDS.map(({ f, label, hint, required }) => (
                    <label key={f} style={{ display: "grid", gap: 3, fontSize: 13 }}>
                      <span>
                        {label}{required ? " *" : ""}
                        {hint ? <span style={S.muted}> — {hint}</span> : null}
                      </span>
                      <select style={{ ...S.input, ...(required && !mapping?.[f] ? { borderColor: "#f87171" } : {}) }}
                        value={mapping?.[f] || ""} onChange={(e) => setMapping({ ...(mapping || {}), [f]: e.target.value || undefined })}>
                        <option value="">— not in this file —</option>
                        {read.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {read.sample && read.sample.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ ...S.muted, marginBottom: 6 }}>First rows of the file</div>
                  <table style={S.table}>
                    <thead><tr>{read.headers.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>{read.sample.map((r, i) => <tr key={i}>{read.headers.map((_, j) => <td key={j} style={S.td}>{r[j]}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}

              {read.preview && read.preview.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ ...S.muted, marginBottom: 6 }}>How the first payments will be saved</div>
                  <table style={S.table}>
                    <thead><tr>{["When", "Payer", "Type", "Amount", "Via", "Status", "Transaction ID"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {read.preview.map((p) => (
                        <tr key={p.external_id}>
                          <td style={S.td}>{shortTime(p.paid_at)}</td>
                          <td style={S.td}>{p.payer_handle || p.payer_name || <span style={S.muted}>—</span>}{p.payer_handle && p.payer_name ? <div style={S.muted}>{p.payer_name}</div> : null}</td>
                          <td style={{ ...S.td, ...(p.direction === "out" ? S.warn : {}) }}>{p.direction === "out" ? "Refund / payout" : "Payment"}</td>
                          <td style={{ ...S.td, ...S.num }}>{money(p.amount)}</td>
                          <td style={S.td}>{p.method || "—"}</td>
                          <td style={S.td}>{p.status || "—"}</td>
                          <td style={{ ...S.td, ...S.muted }}>{p.external_id.startsWith("auto:") ? "(none in file)" : p.external_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {read.warnings?.map((w, i) => <div key={i} style={S.muted}>Note: {w}</div>)}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={S.btnGhost} disabled={busy} onClick={() => readFile(mapping)}>Re-read with these columns</button>
                <button style={S.btn} disabled={busy || !read.rows || !mapping?.paid_at || !mapping?.amount} onClick={doImport}>
                  {busy ? "Working…" : `Import ${read.rows ?? ""} payment(s)`}
                </button>
              </div>
            </div>
          )}

          {msg && (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              <div style={msg.ok ? S.ok : S.bad}>{msg.ok ? "✓ Imported" : "✗"} {msg.text}</div>
              {msg.warnings?.map((w, i) => <div key={i} style={{ marginLeft: 16, ...S.muted }}>Note: {w}</div>)}
            </div>
          )}
        </section>

        {/* 2. Reconciliation */}
        <section style={S.card}>
          <h2 style={S.h2}>2. Money in vs. points loaded</h2>
          <p style={{ ...S.muted, margin: "0 0 12px" }}>
            Per business day (5:00 AM → 4:59 AM). &quot;Loaded&quot; adds up deposits from every game panel report uploaded for that day,
            so a day only fully checks out once every panel and every payment partner is uploaded.
          </p>
          {loadErr && <p style={S.bad}>{loadErr}</p>}
          {activeDays.length === 0 ? (
            <p style={S.muted}>Nothing to compare yet — upload a payment export and the game panel reports for the same day.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {["Day", "Money in", "Refunds / payouts", "Points loaded", "Redeemed", "Difference", "Uploaded", "Status"].map((h, i) =>
                      <th key={h} style={{ ...S.th, ...(i >= 1 && i <= 5 ? { textAlign: "right" } : {}) }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((d) => {
                    const st = dayStatus(d);
                    return (
                      <tr key={d.business_date}>
                        <td style={S.td}>{prettyDate(d.business_date)}</td>
                        <td style={{ ...S.td, ...S.num }}>{money(d.paid_in)}<div style={S.muted}>{d.payment_count} pmt · {d.payers} payer(s)</div></td>
                        <td style={{ ...S.td, ...S.num }}>{Number(d.paid_out) ? money(d.paid_out) : "—"}</td>
                        <td style={{ ...S.td, ...S.num }}>{money(d.loaded)}<div style={S.muted}>{d.load_count} load(s)</div></td>
                        <td style={{ ...S.td, ...S.num }}>{money(d.redeemed)}</td>
                        <td style={{ ...S.td, ...S.num, ...(st.tone === "bad" ? S.bad : st.tone === "ok" ? S.ok : {}) }}>{money(d.gap)}</td>
                        <td style={{ ...S.td, ...S.muted }}>{d.panels_uploaded} panel(s) · {d.partners_uploaded} partner(s)</td>
                        <td style={{ ...S.td, ...(st.tone === "ok" ? S.ok : st.tone === "bad" ? S.bad : st.tone === "warn" ? S.warn : S.muted) }}>{st.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Payers */}
        <section style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ ...S.h2, margin: 0 }}>3. Payers — one person across every game</h2>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "unlinked"] as const).map((k) => (
                <button key={k} style={{ ...S.btnGhost, ...(payerFilter === k ? { borderColor: "#facc15", color: "#fde68a" } : {}) }} onClick={() => setPayerFilter(k)}>
                  {k === "all" ? `All (${payers.length})` : `Not tied to a member (${payers.filter((p) => !p.member_id).length})`}
                </button>
              ))}
            </div>
          </div>
          <p style={{ ...S.muted, margin: "8px 0 12px" }}>
            A player has a different username on each game panel but usually pays from the same handle. Tie a payer to a member once,
            and every payment from that handle counts toward that member — biggest payers first.
          </p>
          {shownPayers.length === 0 ? (
            <p style={S.muted}>{payers.length === 0 ? "No payers yet — upload a payment export first." : "Every payer is tied to a member."}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Payer", "Paid in", "Payments", "Days", "Last paid", "Via", "Member"].map((h, i) =>
                    <th key={h} style={{ ...S.th, ...(i >= 1 && i <= 3 ? { textAlign: "right" } : {}) }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shownPayers.slice(0, 200).map((p) => (
                    <tr key={p.handle_key}>
                      <td style={S.td}>{p.display}{p.names.filter((n) => n !== p.display).length ? <div style={S.muted}>{p.names.filter((n) => n !== p.display).join(", ")}</div> : null}</td>
                      <td style={{ ...S.td, ...S.num }}>{money(p.paid_in)}{p.paid_out ? <div style={S.muted}>−{money(p.paid_out)} refunds</div> : null}</td>
                      <td style={{ ...S.td, ...S.num }}>{p.payments}</td>
                      <td style={{ ...S.td, ...S.num }}>{p.days}</td>
                      <td style={S.td}>{p.last_paid ? prettyDate(p.last_paid) : "—"}</td>
                      <td style={{ ...S.td, ...S.muted }}>{[...p.methods, ...p.partners.map((c) => partners.find((x) => x.code === c)?.name || c)].filter((v, i, a) => a.indexOf(v) === i).join(" · ")}</td>
                      <td style={S.td}><PayerLink payer={p} onDone={refresh} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Upload history */}
        {uploads.length > 0 && (
          <section style={S.card}>
            <h2 style={S.h2}>Payment uploads</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead><tr>{["Partner", "Covers", "Payers", "In", "New / skipped", "File", "Uploaded", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id}>
                      <td style={S.td}>{partners.find((p) => p.code === u.platform)?.name || u.platform}</td>
                      <td style={S.td}>{shortTime(u.period_start)} → {shortTime(u.period_end)}</td>
                      <td style={S.td}>{u.account_count}</td>
                      <td style={{ ...S.td, ...S.num }}>{money(u.total_in)}</td>
                      <td style={S.td}>{u.new_rows ?? "—"} / {u.skipped_rows ?? "—"}</td>
                      <td style={{ ...S.td, ...S.muted, maxWidth: 220, overflowWrap: "anywhere" }}>{u.source_file}</td>
                      <td style={{ ...S.td, ...S.muted }}>
                        {new Date(u.uploaded_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {u.uploader?.username ? ` · ${u.uploader.username}` : ""}
                      </td>
                      <td style={S.td}>{u.new_rows ? <UndoButton upload={u} onDone={refresh} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
