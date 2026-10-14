"use client";

// Daily Game Report upload — part of the Host Console.
// Hosts upload the game panel's daily report CSV (5:00 AM -> 4:59 AM), link new
// platform account numbers to Zeus members, and see missing / partial days.

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UploadResult = {
  file: string;
  ok: boolean;
  message: string;
  warnings?: string[];
  unlinked?: string[];
};

type DayRow = {
  id: string;
  platform: string;
  game?: string | null;
  business_date: string;
  period_end: string;
  is_complete: boolean;
  account_count: number;
  total_in: number;
  total_out: number;
  gross_net: number;
  uploaded_at: string;
  uploader?: { username: string | null; first_name: string | null } | null;
};

type TxnUpload = {
  id: string;
  platform: string;
  game: string | null;
  period_start: string;
  period_end: string;
  account_count: number;
  total_in: number;
  total_out: number;
  new_rows: number | null;
  skipped_rows: number | null;
  uploaded_at: string;
  uploader?: { username: string | null; first_name: string | null } | null;
};

type Issue = { platform: string; business_date: string; problem: "missing" | "partial" };

type AccountRow = {
  platform: string;
  account_number: string;
  display_name: string | null;
  member_id: string | null;
  member?: { id: string; username: string | null; first_name: string | null; last_name: string | null; email: string | null } | null;
  total_in: number;
  total_out: number;
  days: number;
  last_seen: string | null;
};

type MemberHit = { id: string; username: string | null; first_name: string | null; last_name: string | null; email: string | null };

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No active session. Please log in again.");
  return token;
}

async function api(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

async function fileToBase64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const shortTime = (ts: string) =>
  new Date(ts.replace(" ", "T")).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Game = { code: string; name: string };
type Panel = { platform: string; default_game: string | null };

const money = (n: number | string | null | undefined) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const memberLabel = (m?: MemberHit | null) =>
  !m ? "" : [m.first_name, m.last_name].filter(Boolean).join(" ") + (m.username ? ` (@${m.username})` : "") || m.email || m.id;

const S = {
  page: { minHeight: "100vh", background: "#000", color: "#e5e7eb", padding: "96px 16px 60px" } as React.CSSProperties,
  wrap: { maxWidth: 1000, margin: "0 auto", display: "grid", gap: 20 } as React.CSSProperties,
  card: { background: "rgba(15,23,42,0.85)", border: "1px solid #374151", borderRadius: 16, padding: 20 } as React.CSSProperties,
  h1: { fontFamily: "var(--font-cinzel), serif", fontSize: "1.8rem", margin: 0, color: "#fbbf24" } as React.CSSProperties,
  h2: { margin: "0 0 12px", fontSize: 16, fontFamily: "var(--font-cinzel), serif", color: "#fde68a" } as React.CSSProperties,
  btn: { padding: "9px 14px", borderRadius: 10, border: "none", background: "#facc15", color: "#000", fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  btnGhost: { padding: "6px 10px", borderRadius: 8, border: "1px solid #4b5563", background: "transparent", color: "#e5e7eb", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  input: { padding: "7px 10px", borderRadius: 8, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb", fontSize: 14 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 } as React.CSSProperties,
  th: { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #374151", color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" } as React.CSSProperties,
  td: { padding: "8px 6px", borderBottom: "1px solid #1f2937", verticalAlign: "top" } as React.CSSProperties,
  ok: { color: "#86efac" } as React.CSSProperties,
  bad: { color: "#fca5a5" } as React.CSSProperties,
  warn: { color: "#fcd34d" } as React.CSSProperties,
  muted: { color: "#9ca3af", fontSize: 13 } as React.CSSProperties,
};

function LinkCell({ acct, onDone }: { acct: AccountRow; onDone: () => void }) {
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
      await api("/api/host/import/accounts", {
        method: "POST",
        body: JSON.stringify({ platform: acct.platform, account_number: acct.account_number, member_id }),
      });
      setHits(null); setQ("");
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (acct.member_id) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={S.ok}>{memberLabel(acct.member)}</span>
        <button style={S.btnGhost} disabled={busy} onClick={() => link(null)}>Unlink</button>
        {err && <span style={S.bad}>{err}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          style={{ ...S.input, width: 190 }}
          placeholder="Member username or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
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

export default function HostImportPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [game, setGame] = useState<string>("");
  const [remember, setRemember] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const gameName = (code?: string | null) =>
    !code || code === "both" ? "Several games" : games.find((g) => g.code === code)?.name || code;
  const [results, setResults] = useState<UploadResult[]>([]);

  const [days, setDays] = useState<DayRow[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [txnUploads, setTxnUploads] = useState<TxnUpload[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [showLinked, setShowLinked] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Host-only guard (same check as the Host Console)
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
      const [b, a, g] = await Promise.all([
        api("/api/host/import/batches"),
        api("/api/host/import/accounts"),
        api("/api/host/import/games"),
      ]);
      setGames(g.games || []);
      setPanels(g.panels || []);
      setDays(b.days || []);
      setIssues(b.issues || []);
      setTxnUploads(b.transactionUploads || []);
      setAccounts(a.accounts || []);
    } catch (e: any) { setLoadErr(e.message); }
  }, []);

  useEffect(() => { if (!checking && !accessError) refresh(); }, [checking, accessError, refresh]);

  async function upload() {
    if (!files.length) return;
    setUploading(true);
    const out: UploadResult[] = [];
    // Oldest file first, so if the same day is uploaded twice the later export wins.
    const sorted = [...files].sort((x, y) => x.name.localeCompare(y.name));
    for (const f of sorted) {
      try {
        const isExcel = /\.xlsx$/i.test(f.name);
        const payload = isExcel
          ? { filename: f.name, base64: await fileToBase64(f), game, remember }
          : { filename: f.name, content: await f.text(), game, remember };
        const r = await api("/api/host/import", { method: "POST", body: JSON.stringify(payload) });
        const s = r.summary;
        const message =
          r.kind === "transactions"
            ? `${r.platform} · ${gameName(s.game)} · ${s.new_rows} new deposit record(s)` +
              (s.skipped_rows ? `, ${s.skipped_rows} already uploaded` : "") +
              (s.tagged_rows ? ` (${s.tagged_rows} of those now tagged ${gameName(s.game)})` : "") +
              ` · ${shortTime(s.first)} → ${shortTime(s.last)} · in ${money(s.total_in)}` +
              (Number(s.total_out) ? ` · out ${money(s.total_out)}` : "")
            : `${prettyDate(s.business_date)} · ${r.platform} · ${gameName(s.game)} · ${s.accounts} players · in ${money(s.total_in)} · out ${money(s.total_out)} · net ${money(s.gross_net)}` +
              (s.is_complete ? " · full day ✓" : ` · PARTIAL (through ${r.periodEnd.slice(11, 16)}) — upload the full day later`);
        const warnings = [...(r.warnings || [])];
        if (s?.conflicts) {
          warnings.unshift(`${s.conflicts} deposit(s) in this file were already tagged as the OTHER game and were left unchanged — check you picked the right game.`);
        }
        out.push({ file: f.name, ok: !s?.conflicts, message, warnings, unlinked: r.unlinkedInFile });
      } catch (e: any) {
        out.push({ file: f.name, ok: false, message: e.message });
      }
      setResults([...out]);
    }
    setUploading(false);
    setFiles([]);
    setGame(""); // back to automatic for the next upload
    setRemember(false);
    const input = document.getElementById("report-file") as HTMLInputElement | null;
    if (input) input.value = "";
    refresh();
  }

  if (checking) return <main style={S.page}><div style={S.wrap}>Checking access…</div></main>;
  if (accessError) return <main style={S.page}><div style={S.wrap}><p style={S.bad}>{accessError}</p></div></main>;

  const unlinked = accounts.filter((a) => !a.member_id);
  const shownAccounts = showLinked ? accounts : unlinked;

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h1 style={S.h1}>Daily Game Report</h1>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/host/payments" style={{ color: "#93c5fd", textDecoration: "underline" }}>Payments</Link>
            <Link href="/host" style={{ color: "#93c5fd", textDecoration: "underline" }}>← Back to Host Console</Link>
          </div>
        </div>

        {/* 1. Upload */}
        <section style={S.card}>
          <h2 style={S.h2}>1. Upload yesterday&apos;s report</h2>
          <ol style={{ margin: "0 0 14px", paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
            <li>
              <b>Fire Phoenix — zeusgames panel (CSV):</b> open the per-player report (starts with &quot;Account&quot;), set <b>yesterday 5:00 AM → today 4:59 AM</b>, export.{" "}
              <b>Don&apos;t rename the file</b> — the date is read from the file name. Re-uploading a day replaces it.
            </li>
            <li>
              <b>Zeusgames2 panel — Dragon Fury &amp; SLOTMANIA (Excel):</b> Record Enquiry → top-up records, tick <b>one game only</b>, press <b>Yesterday</b>, export.
              Then do the same for the other game. Upload each file with the matching game selected below.
              Each deposit has an order number, so overlapping or repeated uploads are skipped automatically.
            </li>
            <li>
              Choose one or more files below and press Upload. Leave the game on <b>Automatic</b> for panels that only carry one game;
              pick the game for mixed panels (Zeusgames2) or a panel you&apos;re uploading for the first time.
            </li>
          </ol>
          {panels.length > 0 && (
            <p style={{ ...S.muted, margin: "0 0 12px" }}>
              Known panels:{" "}
              {panels.map((p, i) => (
                <span key={p.platform}>
                  {i > 0 ? " · " : ""}
                  <b>{p.platform}</b> → {p.default_game ? gameName(p.default_game) : "choose game each upload"}
                </span>
              ))}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              id="report-file"
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              style={{ color: "#e5e7eb" }}
            />
            <select value={game} onChange={(e) => { setGame(e.target.value); setRemember(false); }} style={S.input}>
              <option value="">Game: Automatic (panel&apos;s usual game)</option>
              {games.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
              <option value="both">Several games (not separated)</option>
            </select>
            {game && game !== "both" && (
              <label style={{ ...S.muted, display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                This panel only has this game — remember it
              </label>
            )}
            <button style={S.btn} disabled={!files.length || uploading} onClick={upload}>
              {uploading ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
            </button>
          </div>
          {results.length > 0 && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {results.map((r, i) => (
                <div key={i} style={{ fontSize: 14 }}>
                  <div style={r.ok ? S.ok : S.bad}>{r.ok ? "✓" : "✗"} {r.file}</div>
                  <div style={{ marginLeft: 16 }}>{r.message}</div>
                  {r.unlinked && r.unlinked.length > 0 && (
                    <div style={{ marginLeft: 16, ...S.warn }}>
                      {r.unlinked.length} account(s) in this file aren&apos;t linked to a member yet — see step 3.
                    </div>
                  )}
                  {r.warnings?.map((w, j) => <div key={j} style={{ marginLeft: 16, ...S.muted }}>Note: {w}</div>)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Days */}
        <section style={S.card}>
          <h2 style={S.h2}>2. Uploaded days</h2>
          {loadErr && <p style={S.bad}>{loadErr}</p>}
          {issues.length > 0 ? (
            <div style={{ marginBottom: 12, display: "grid", gap: 4 }}>
              {issues.map((d) => (
                <div key={`${d.platform}${d.business_date}`} style={d.problem === "missing" ? S.bad : S.warn}>
                  {d.problem === "missing" ? "Missing" : "Partial (re-upload the full day)"}: {prettyDate(d.business_date)} · {d.platform}
                </div>
              ))}
            </div>
          ) : days.length > 0 ? (
            <p style={{ ...S.ok, marginTop: 0 }}>All days are uploaded and complete.</p>
          ) : null}
          {days.length === 0 ? (
            <p style={S.muted}>Nothing uploaded yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {["Day", "Store", "Game", "Status", "Players", "In", "Out", "Net", "Uploaded"].map((h) => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {days.slice(0, 31).map((d) => (
                    <tr key={d.id}>
                      <td style={S.td}>{prettyDate(d.business_date)}</td>
                      <td style={S.td}>{d.platform}</td>
                      <td style={S.td}>{gameName(d.game)}</td>
                      <td style={{ ...S.td, ...(d.is_complete ? S.ok : S.warn) }}>{d.is_complete ? "Full day" : `Partial to ${d.period_end.slice(11, 16)}`}</td>
                      <td style={S.td}>{d.account_count}</td>
                      <td style={S.td}>{money(d.total_in)}</td>
                      <td style={S.td}>{money(d.total_out)}</td>
                      <td style={S.td}>{money(d.gross_net)}</td>
                      <td style={{ ...S.td, ...S.muted }}>
                        {new Date(d.uploaded_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {d.uploader?.username ? ` · ${d.uploader.username}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {txnUploads.length > 0 && (
          <section style={S.card}>
            <h2 style={S.h2}>Deposit record uploads (Excel)</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Store", "Game", "Covers", "Players", "In", "New / skipped", "Uploaded"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {txnUploads.map((u) => (
                    <tr key={u.id}>
                      <td style={S.td}>{u.platform}</td>
                      <td style={S.td}>{gameName(u.game)}</td>
                      <td style={S.td}>{shortTime(u.period_start)} → {shortTime(u.period_end)}</td>
                      <td style={S.td}>{u.account_count}</td>
                      <td style={S.td}>{money(u.total_in)}</td>
                      <td style={S.td}>{u.new_rows ?? "—"} / {u.skipped_rows ?? "—"}</td>
                      <td style={{ ...S.td, ...S.muted }}>
                        {new Date(u.uploaded_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {u.uploader?.username ? ` · ${u.uploader.username}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. Link accounts */}
        <section style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ ...S.h2, margin: 0 }}>3. Link game accounts to members</h2>
            <label style={{ ...S.muted, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={showLinked} onChange={(e) => setShowLinked(e.target.checked)} />
              Show linked accounts too
            </label>
          </div>
          <p style={{ ...S.muted, margin: "8px 0 12px" }}>
            Each game account number only needs linking once. Biggest depositors are listed first.
            {unlinked.length > 0 ? ` ${unlinked.length} account(s) still unlinked.` : " Every account is linked."}
          </p>
          {shownAccounts.length === 0 ? (
            <p style={S.muted}>{accounts.length === 0 ? "No accounts yet — upload a report first." : "Nothing to link."}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Account", "Store", "Total in", "Days", "Last seen", "Member"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shownAccounts.map((a) => (
                    <tr key={`${a.platform}|${a.account_number}`}>
                      <td style={S.td}>
                        {a.account_number}
                        {a.display_name ? <div style={S.muted}>{a.display_name}</div> : null}
                      </td>
                      <td style={S.td}>{a.platform}</td>
                      <td style={S.td}>{money(a.total_in)}</td>
                      <td style={S.td}>{a.days}</td>
                      <td style={S.td}>{a.last_seen ? prettyDate(a.last_seen) : "—"}</td>
                      <td style={S.td}><LinkCell acct={a} onDone={refresh} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
