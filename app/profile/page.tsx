"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DailyMissionsPanel from "@/app/components/DailyMissionsPanel";

type ProfileRow = {
  id: string;
  email?: string | null;
  username?: string | null;

  first_name?: string | null;
  last_name?: string | null;

  points?: number | null;
  zeus_coins?: number | null;

  referral_code?: string | null;
  referred_by?: string | null;

  is_host?: boolean | null;
  invite_code?: string | null;

  account_tier?: string | null;
  lifetime_coins_spent?: number | null;
  favorite_game?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [copied, setCopied] = useState<null | "code" | "link">(null);

  const referralCode = profile?.referral_code ?? null;

  const referralLink = useMemo(() => {
    if (!referralCode) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/signup?ref=${encodeURIComponent(
      referralCode
    )}`;
  }, [referralCode]);

  const fullName = useMemo(() => {
    const name = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || "—";
  }, [profile?.first_name, profile?.last_name]);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);

      // Auth (cookie-based session)
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr) {
        setErr(sessionErr.message);
        setProfile(null);
        setAuthUserId(null);
        setEmail(null);
        return;
      }

      const user = sessionData.session?.user ?? null;

      if (!user) {
        setAuthUserId(null);
        setEmail(null);
        setProfile(null);
        router.replace(
          "/login?message=Please%20log%20in%20to%20view%20your%20profile"
        );
        return;
      }

      setAuthUserId(user.id);
      setEmail(user.email ?? null);

      // Pull only columns that exist in your profiles table
      const { data: row, error: profileErr } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          username,
          first_name,
          last_name,
          points,
          zeus_coins,
          referral_code,
          referred_by,
          is_host,
          invite_code,
          account_tier,
          lifetime_coins_spent,
          favorite_game
        `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        setErr(profileErr.message);
        setProfile(null);
        return;
      }

      setProfile({
        id: user.id,
        email: user.email ?? row?.email ?? null,
        ...row,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyText = async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(which);
      setTimeout(() => setCopied(null), 1200);
    }
  };

  if (loading) {
    return (
      <main style={styles.shell}>
        <div style={styles.centerMsg}>Loading profile…</div>
      </main>
    );
  }

  if (err) {
    return (
      <main style={styles.shell}>
        <div style={styles.wrap}>
          <div style={styles.hero}>
            <h1 style={styles.h1}>PROFILE</h1>
            <p style={styles.sub}>Something went wrong loading your account.</p>
          </div>

          <div style={styles.card}>
            <div style={{ color: "#fecaca", fontWeight: 700 }}>{err}</div>
            <button onClick={load} style={{ ...styles.btn, marginTop: 12 }}>
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!authUserId) {
    return (
      <main style={styles.shell}>
        <div style={styles.centerMsg}>Not logged in</div>
      </main>
    );
  }

  const tier = profile?.account_tier ?? "Standard";
  const coins = profile?.zeus_coins ?? 0;
  const points = profile?.points ?? 0;

  return (
    <main style={styles.shell}>
      <div style={styles.wrap}>
        {/* HERO */}
        <div style={styles.hero}>
          <div style={styles.heroTopRow}>
            <div>
              <h1 style={styles.h1}>PROFILE</h1>
              <p style={styles.sub}>
                Manage your Zeus Lounge account, coins, and referral perks.
              </p>
            </div>

            <div style={styles.badgeRow}>
              <span style={styles.badgeGold}>⚡ {tier}</span>
              {profile?.is_host && <span style={styles.badgeBlue}>👑 Host</span>}
            </div>
          </div>
        </div>

        {/* GRID */}
        <section style={styles.grid}>
          {/* LEFT: Identity / Stats */}
          <div style={styles.card}>
            <div style={styles.cardTitleRow}>
              <div style={styles.cardTitle}>Account Overview</div>
              <div style={styles.miniGlowDot} />
            </div>

            <div style={styles.kvGrid}>
              <KV label="Username" value={profile?.username ?? "—"} />
              <KV label="Name" value={fullName} />
              <KV label="Email" value={email ?? profile?.email ?? "—"} />
              <KV label="User ID" value={authUserId} mono />
            </div>

            <div style={styles.divider} />

            <div style={styles.statRow}>
              <Stat label="Zeus Coins" value={coins.toLocaleString()} />
              <Stat label="Points" value={points.toLocaleString()} />
            </div>

            <div style={styles.note}>
              Coins power your tier perks and rewards. Points track engagement.
            </div>
          </div>

          {/* RIGHT: Referral */}
          <div style={styles.card}>
            <div style={styles.cardTitleRow}>
              <div style={styles.cardTitle}>Referral Perks</div>
              <div style={styles.miniGlowDot} />
            </div>

            <p style={styles.p}>
              Share your code to invite friends. Referrals help you grow your
              Zeus account.
            </p>

            <div style={styles.refBox}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={styles.smallLabel}>Referral Code</div>
                <div style={styles.refCode}>
                  {referralCode ?? "—"}
                  {referralCode && (
                    <button
                      onClick={() => copyText(referralCode, "code")}
                      style={styles.iconBtn}
                      title="Copy code"
                    >
                      📋
                    </button>
                  )}
                </div>
              </div>

              {referralLink && (
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  <div style={styles.smallLabel}>Referral Link</div>
                  <div style={styles.refLinkRow}>
                    <div style={styles.refLinkText}>{referralLink}</div>
                    <button
                      onClick={() => copyText(referralLink, "link")}
                      style={styles.iconBtn}
                      title="Copy link"
                    >
                      🔗
                    </button>
                  </div>
                </div>
              )}

              {copied && (
                <div style={styles.copied}>
                  Copied {copied === "code" ? "code" : "link"} ✅
                </div>
              )}
            </div>

            <div style={styles.divider} />

            <div style={styles.actions}>
              <Link href="/bonus" style={styles.actionBtn}>
                🎡 Daily Wheel
              </Link>
              <Link href="/rewards" style={styles.actionBtn}>
                🏆 Rewards
              </Link>
              <Link href="/coins" style={styles.actionBtn}>
                🪙 Coin Ledger
              </Link>
              {profile?.is_host && (
                <Link href="/host" style={styles.actionBtnBlue}>
                  ⚡ Host Console
                </Link>
              )}
            </div>
          </div>

          {/* OPTIONAL: Favorite game / lifetime (only if present) */}
          <div style={styles.cardWide}>
            <div style={styles.cardTitleRow}>
              <div style={styles.cardTitle}>Extra Details</div>
              <div style={styles.miniGlowDot} />
            </div>

            <div style={styles.kvGrid}>
              <KV label="Favorite Game" value={profile?.favorite_game ?? "—"} />
              <KV
                label="Lifetime Coins Spent"
                value={(profile?.lifetime_coins_spent ?? 0).toLocaleString()}
              />
              <KV label="Invite Code" value={profile?.invite_code ?? "—"} mono />
              <KV label="Referred By" value={profile?.referred_by ?? "—"} mono />
            </div>
          </div>

          {/* Daily Missions */}
          <DailyMissionsPanel />
        </section>
      </div>
    </main>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={styles.kv}>
      <div style={styles.kvLabel}>{label}</div>
      <div style={{ ...styles.kvValue, ...(mono ? styles.mono : null) }}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "92px 16px 36px",
    color: "#f9fafb",
    background:
      "radial-gradient(circle at top, rgba(250,204,21,0.12), rgba(0,0,0,0.0) 40%), radial-gradient(circle at 20% 10%, rgba(168,85,247,0.12), rgba(0,0,0,0.0) 45%), #000",
    fontFamily:
      "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
  },
  wrap: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 },
  centerMsg: {
    minHeight: "60vh",
    display: "grid",
    placeItems: "center",
    color: "#e5e7eb",
    fontWeight: 700,
  },

  hero: {
    borderRadius: 18,
    border: "1px solid rgba(255,215,0,0.22)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(0,0,0,0.55))",
    boxShadow: "0 24px 55px rgba(0,0,0,0.65)",
    padding: 18,
  },
  heroTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  h1: {
    margin: 0,
    fontFamily: "var(--font-cinzel), serif",
    fontSize: 40,
    letterSpacing: "0.06em",
    background: "linear-gradient(to right, #facc15, #fb923c, #facc15)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow: "0 0 18px rgba(250,204,21,0.18)",
  },
  sub: { margin: "6px 0 0", color: "#9ca3af", fontSize: 14 },

  badgeRow: { display: "flex", gap: 8, alignItems: "center" },
  badgeGold: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.35)",
    background: "rgba(250,204,21,0.10)",
    color: "#fde68a",
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontSize: 12,
  },
  badgeBlue: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.12)",
    color: "#bfdbfe",
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontSize: 12,
  },

  grid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  },

  card: {
    gridColumn: "span 12",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.86)",
    padding: 16,
    boxShadow: "0 18px 45px rgba(0,0,0,0.60)",
  },
  cardWide: {
    gridColumn: "span 12",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(12,20,35,0.88)",
    padding: 16,
    boxShadow: "0 18px 45px rgba(0,0,0,0.60)",
  },

  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  cardTitle: {
    fontFamily: "var(--font-cinzel), serif",
    color: "#e5e7eb",
    fontSize: 16,
    letterSpacing: "0.04em",
  },
  miniGlowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(250,204,21,0.9)",
    boxShadow: "0 0 18px rgba(250,204,21,0.55)",
  },

  kvGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  kv: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.25)",
    padding: 12,
  },
  kvLabel: { color: "#9ca3af", fontSize: 12, letterSpacing: "0.06em" },
  kvValue: { marginTop: 6, color: "#f9fafb", fontWeight: 800, fontSize: 14 },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" },

  divider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
    margin: "14px 0",
  },

  statRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  stat: {
    borderRadius: 16,
    border: "1px solid rgba(250,204,21,0.18)",
    background: "linear-gradient(180deg, rgba(250,204,21,0.10), rgba(0,0,0,0.22))",
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#fde68a",
    fontWeight: 900,
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 900,
    color: "#f9fafb",
    fontFamily: "var(--font-cinzel), serif",
  },

  note: { marginTop: 10, color: "#9ca3af", fontSize: 12 },

  p: { margin: "0 0 12px", color: "#d1d5db", fontSize: 13, lineHeight: 1.5 },

  refBox: {
    borderRadius: 16,
    border: "1px solid rgba(250,204,21,0.20)",
    background: "rgba(0,0,0,0.28)",
    padding: 12,
  },
  smallLabel: {
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#9ca3af",
    fontWeight: 800,
  },
  refCode: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 12,
    padding: "10px 10px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.75)",
    fontWeight: 900,
  },
  refLinkRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: "10px 10px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.75)",
  },
  refLinkText: {
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: 700,
  },
  iconBtn: {
    border: "1px solid rgba(250,204,21,0.25)",
    background: "rgba(250,204,21,0.10)",
    color: "#fff",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 900,
  },
  copied: { marginTop: 10, color: "#86efac", fontSize: 13, fontWeight: 800 },

  actions: { display: "flex", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,215,0,0.22)",
    background: "rgba(255,215,0,0.08)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
  },
  actionBtnBlue: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.28)",
    background: "rgba(59,130,246,0.12)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
  },

  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,215,0,0.35)",
    background: "rgba(255,215,0,0.10)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
};

// Responsive: stack the grid on small screens
// (kept inline-free so nothing else in your app is impacted)
if (typeof window !== "undefined") {
  // no-op: you can ignore; styling is already mobile-safe because grid uses span 12
}