"use client";

// Host-only admin view for Daily Missions. Rendered inside app/host/page.tsx,
// which already gates the whole page on profiles.is_host. RLS also
// independently restricts the underlying data to hosts, so this is
// defense-in-depth, not the only gate.

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/lib/database.types";

type MissionPoolRow = Tables<"mission_pool">;
type UserDailyMissionRow = Tables<"user_daily_missions">;
type ProfileLite = { id: string; username: string | null; email: string | null };

type AuditRow = UserDailyMissionRow & {
  mission_title: string;
  username: string;
};

export default function MissionHostPanel() {
  const [missions, setMissions] = useState<MissionPoolRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [poolRes, recentRes] = await Promise.all([
        supabase.from("mission_pool").select("*").order("sort_order"),
        supabase
          .from("user_daily_missions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (poolRes.error) throw poolRes.error;
      if (recentRes.error) throw recentRes.error;

      const pool = (poolRes.data ?? []) as MissionPoolRow[];
      const recent = (recentRes.data ?? []) as UserDailyMissionRow[];

      const userIds = Array.from(new Set(recent.map((r) => r.user_id)));
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, username, email").in("id", userIds)
        : { data: [] as ProfileLite[] };

      const profileById = new Map(((profilesData ?? []) as ProfileLite[]).map((p) => [p.id, p]));
      const missionByCode = new Map(pool.map((m) => [m.code, m]));

      const mergedAudit: AuditRow[] = recent.map((r) => ({
        ...r,
        mission_title: missionByCode.get(r.mission_code)?.title ?? r.mission_code,
        username:
          profileById.get(r.user_id)?.username ??
          profileById.get(r.user_id)?.email ??
          r.user_id.slice(0, 8),
      }));

      setMissions(pool);
      setAudit(mergedAudit);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load mission data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function updateLocal(code: string, patch: Partial<MissionPoolRow>) {
    setMissions((prev) => prev.map((m) => (m.code === code ? { ...m, ...patch } : m)));
  }

  async function saveMission(code: string) {
    const mission = missions.find((m) => m.code === code);
    if (!mission) return;
    setSavingCode(code);
    try {
      const { error: updateErr } = await supabase
        .from("mission_pool")
        .update({
          reward_min: mission.reward_min,
          reward_max: mission.reward_max,
          is_active: mission.is_active,
          title: mission.title,
          description: mission.description,
        })
        .eq("code", code);
      if (updateErr) throw updateErr;
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to save mission.");
    } finally {
      setSavingCode(null);
    }
  }

  if (loading) {
    return <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Loading missions…</p>;
  }
  if (error) {
    return <p style={{ margin: 0, fontSize: 13, color: "#fecaca" }}>{error}</p>;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#fbbf24" }}>Mission Catalog</h3>
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", textAlign: "left", color: "#9ca3af" }}>
                <th style={cellStyle}>Active</th>
                <th style={cellStyle}>Title</th>
                <th style={cellStyle}>Verification</th>
                <th style={cellStyle}>Min</th>
                <th style={cellStyle}>Max</th>
                <th style={cellStyle} />
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr key={m.code} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={cellStyle}>
                    <input
                      type="checkbox"
                      checked={m.is_active}
                      onChange={(e) => updateLocal(m.code, { is_active: e.target.checked })}
                    />
                  </td>
                  <td style={{ ...cellStyle, color: "#e5e7eb" }}>{m.title}</td>
                  <td style={{ ...cellStyle, color: "#9ca3af" }}>{m.verification_method}</td>
                  <td style={cellStyle}>
                    <input
                      type="number"
                      value={m.reward_min}
                      onChange={(e) => updateLocal(m.code, { reward_min: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number"
                      value={m.reward_max}
                      onChange={(e) => updateLocal(m.code, { reward_max: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => saveMission(m.code)}
                      disabled={savingCode === m.code}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "none",
                        background: "linear-gradient(90deg, #facc15, #f97316)",
                        color: "#111827",
                        fontWeight: 800,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {savingCode === m.code ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#fbbf24" }}>
          Recent Activity{" "}
          <span style={{ fontWeight: 400, color: "#6b7280" }}>(last 100 — spot-check honor-system missions)</span>
        </h3>
        <div style={{ maxHeight: 320, overflowY: "auto", borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#0b1220" }}>
              <tr style={{ textAlign: "left", color: "#9ca3af" }}>
                <th style={cellStyle}>User</th>
                <th style={cellStyle}>Mission</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Reward</th>
                <th style={cellStyle}>Claimed At</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ ...cellStyle, color: "#e5e7eb" }}>{row.username}</td>
                  <td style={{ ...cellStyle, color: "#d1d5db" }}>{row.mission_title}</td>
                  <td style={{ ...cellStyle, color: "#9ca3af" }}>{row.status}</td>
                  <td style={{ ...cellStyle, color: "#9ca3af" }}>{row.reward_amount ?? "—"}</td>
                  <td style={{ ...cellStyle, color: "#6b7280" }}>
                    {row.claimed_at ? new Date(row.claimed_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "8px 10px" };
const inputStyle: React.CSSProperties = {
  width: 64,
  padding: "4px 6px",
  borderRadius: 6,
  border: "1px solid #4b5563",
  background: "#020617",
  color: "#e5e7eb",
};
