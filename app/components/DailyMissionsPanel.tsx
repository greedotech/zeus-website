"use client";

// Daily Missions card for the profile page. Self-contained (data loading +
// UI) to match the style of the other feature panels in this app
// (bonus/page.tsx, dailyspincard.tsx).

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/lib/database.types";

type MissionPoolRow = Tables<"mission_pool">;
type UserDailyMissionRow = Tables<"user_daily_missions">;
type UserMissionStatsRow = Tables<"user_mission_stats">;

type DailyMission = UserDailyMissionRow & {
  title: string;
  description: string;
  verification_method: string;
  reward_min: number;
  reward_max: number;
};

type ClaimResult = {
  reward_amount: number;
  new_balance: number;
  current_streak: number;
};

export default function DailyMissionsPanel() {
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [stats, setStats] = useState<UserMissionStatsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [reveal, setReveal] = useState<ClaimResult | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [missionsRes, poolRes, statsRes] = await Promise.all([
        supabase.rpc("get_or_assign_daily_missions"),
        supabase.from("mission_pool").select("*").eq("is_active", true),
        supabase.from("user_mission_stats").select("*").maybeSingle(),
      ]);

      if (missionsRes.error) throw missionsRes.error;
      if (poolRes.error) throw poolRes.error;

      const poolByCode = new Map(
        ((poolRes.data ?? []) as MissionPoolRow[]).map((m) => [m.code, m])
      );

      const merged: DailyMission[] = (
        (missionsRes.data ?? []) as UserDailyMissionRow[]
      ).map((m) => {
        const def = poolByCode.get(m.mission_code);
        return {
          ...m,
          title: def?.title ?? m.mission_code,
          description: def?.description ?? "",
          verification_method: def?.verification_method ?? "manual_claim",
          reward_min: def?.reward_min ?? 0,
          reward_max: def?.reward_max ?? 0,
        };
      });

      setMissions(merged);
      setStats((statsRes.data as UserMissionStatsRow | null) ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load missions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleComplete(code: string) {
    setBusyCode(code);
    try {
      const { error: rpcErr } = await supabase.rpc("complete_mission", {
        p_mission_code: code,
      });
      if (rpcErr) throw rpcErr;
      setMissions((prev) =>
        prev.map((m) =>
          m.mission_code === code
            ? { ...m, status: "completed", completed_at: new Date().toISOString() }
            : m
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setBusyCode(null);
    }
  }

  async function handleClaim(code: string) {
    setBusyCode(code);
    try {
      const { data, error: rpcErr } = await supabase
        .rpc("claim_mission_reward", { p_mission_code: code })
        .single();
      if (rpcErr) throw rpcErr;
      const result = data as unknown as ClaimResult;

      setMissions((prev) =>
        prev.map((m) =>
          m.mission_code === code
            ? {
                ...m,
                status: "claimed",
                claimed_at: new Date().toISOString(),
                reward_amount: result.reward_amount,
              }
            : m
        )
      );
      setStats((prev) => ({
        user_id: prev?.user_id ?? "",
        current_streak: result.current_streak,
        longest_streak: Math.max(prev?.longest_streak ?? 0, result.current_streak),
        last_claim_date: new Date().toISOString().slice(0, 10),
        total_missions_claimed: (prev?.total_missions_claimed ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }));
      setReveal(result);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyCode(null);
    }
  }

  if (loading) {
    return (
      <div style={styles.card}>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>Loading today’s missions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.card}>
        <p style={{ margin: 0, color: "#fecaca", fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardTitleRow}>
        <div style={styles.cardTitle}>Daily Missions</div>
        {stats && stats.current_streak > 0 && (
          <span style={styles.streakBadge}>🔥 {stats.current_streak} day streak</span>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {missions.map((mission) => {
          const isBusy = busyCode === mission.mission_code;
          const waitingOnReferral =
            mission.verification_method === "auto_referral" && mission.status === "pending";

          return (
            <div key={mission.mission_code} style={styles.missionRow}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{mission.title}</div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{mission.description}</div>
                <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                  {mission.reward_min}–{mission.reward_max} Zeus Coins
                </div>
              </div>

              {waitingOnReferral && (
                <span style={styles.pillMuted}>Completes when a friend signs up</span>
              )}

              {!waitingOnReferral && mission.status === "pending" && (
                <button
                  onClick={() => handleComplete(mission.mission_code)}
                  disabled={isBusy}
                  style={styles.btnNeutral}
                >
                  {isBusy ? "…" : "Mark Done"}
                </button>
              )}

              {mission.status === "completed" && (
                <button
                  onClick={() => handleClaim(mission.mission_code)}
                  disabled={isBusy}
                  style={styles.btnGold}
                >
                  {isBusy ? "…" : "Claim Reward"}
                </button>
              )}

              {mission.status === "claimed" && (
                <span style={styles.pillClaimed}>+{mission.reward_amount} claimed</span>
              )}
            </div>
          );
        })}
      </div>

      {reveal && (
        <div style={styles.overlay} onClick={() => setReveal(null)}>
          <div style={styles.revealCard}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af" }}>
              Reward Claimed
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#facc15", marginTop: 6 }}>
              +{reveal.reward_amount}
            </div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>Zeus Coins</div>
            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
              New balance: {reveal.new_balance.toLocaleString()}
            </div>
            <button onClick={() => setReveal(null)} style={{ ...styles.btnGold, marginTop: 16 }}>
              Nice!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    gridColumn: "span 12",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.86)",
    padding: 16,
    boxShadow: "0 18px 45px rgba(0,0,0,0.60)",
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontFamily: "var(--font-cinzel), serif",
    color: "#e5e7eb",
    fontSize: 16,
    letterSpacing: "0.04em",
  },
  streakBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.35)",
    background: "rgba(250,204,21,0.10)",
    color: "#fde68a",
    fontWeight: 800,
    fontSize: 12,
  },
  missionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.25)",
    padding: 12,
  },
  pillMuted: {
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 11,
    color: "#9ca3af",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    whiteSpace: "nowrap",
  },
  pillClaimed: {
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "#86efac",
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.25)",
    whiteSpace: "nowrap",
  },
  btnNeutral: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnGold: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(250,204,21,0.35)",
    background: "linear-gradient(90deg, #facc15, #fb923c)",
    color: "#111827",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
  },
  revealCard: {
    borderRadius: 18,
    background: "rgba(15,23,42,0.98)",
    border: "1px solid rgba(250,204,21,0.35)",
    padding: 28,
    textAlign: "center",
    boxShadow: "0 24px 55px rgba(0,0,0,0.65)",
  },
};
