"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getTierProgress, getTierLabel } from "@/lib/tiers";

type ProfileBits = {
  id: string;
  zeus_coins: number | null;
  lifetime_coins: number | null;
  email: string | null;
};

export default function AccountPage() {
  const [profile, setProfile] = useState<ProfileBits | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          if (!mounted) return;
          setErr("You must be logged in to manage your account.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, zeus_coins, lifetime_coins")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!mounted) return;
        setProfile({
          id: user.id,
          zeus_coins: data?.zeus_coins ?? 0,
          lifetime_coins: data?.lifetime_coins ?? 0,
          email: user.email ?? null,
        });
      } catch (e: any) {
        if (!mounted) return;
        setErr(e.message || "Unable to load account.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <main style={{ minHeight: "60vh", background: "#000", color: "#fff", display: "grid", placeItems: "center" }}>
        Loading account…
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ minHeight: "60vh", background: "#000", color: "#fff", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
        <p>{err}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ minHeight: "60vh", background: "#000", color: "#fff", display: "grid", placeItems: "center" }}>
        <p>Please log in to view your account.</p>
      </main>
    );
  }

  const coins = profile.zeus_coins ?? 0;
  const lifetimeCoins = profile.lifetime_coins ?? 0;

  // Tier is based on lifetime coins earned
  const tierProgress = getTierProgress(lifetimeCoins);
  const tierLabel = getTierLabel(tierProgress.current);
  const tierText = `${tierProgress.current} — ${tierLabel}`;

  const progressPercent = Math.max(0, Math.min(100, tierProgress.percentToNext ?? 100));

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "80px 16px 32px",
        fontFamily: "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 20 }}>

        {/* Header */}
        <header>
          <h1 style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "2.2rem", margin: 0, color: "#facc15" }}>
            Account & Tier
          </h1>
          <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 14 }}>
            View your Zeus Lounge account info and track your tier progression.
          </p>
        </header>

        {/* Account info */}
        <section style={{ background: "rgba(15,23,42,0.9)", borderRadius: 16, border: "1px solid rgba(148,163,184,0.6)", padding: 16, display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, marginBottom: 6, fontFamily: "var(--font-cinzel), serif", fontSize: 16, color: "#e5e7eb" }}>
            Account Details
          </h2>
          <InfoRow label="Email" value={profile.email || "Not set"} />
          <InfoRow label="Zeus Coins (spendable)" value={coins.toLocaleString()} />
          <InfoRow label="Lifetime Coins Earned" value={lifetimeCoins.toLocaleString()} />
        </section>

        {/* Tier progression */}
        <section style={{ background: "rgba(12,20,35,0.95)", borderRadius: 16, border: "1px solid rgba(59,130,246,0.7)", padding: 16, display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, marginBottom: 6, fontFamily: "var(--font-cinzel), serif", fontSize: 16, color: "#bfdbfe" }}>
            Your Zeus Tier & Perks
          </h2>

          <p style={{ margin: 0, fontSize: 14, color: "#e5e7eb" }}>
            Current tier: <strong style={{ color: "#facc15" }}>{tierText}</strong>
          </p>

          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
            Zeus Coins: <strong style={{ color: "#e5e7eb" }}>{coins.toLocaleString()}</strong> spendable &nbsp;·&nbsp; <strong style={{ color: "#e5e7eb" }}>{lifetimeCoins.toLocaleString()}</strong> lifetime earned
          </p>

          {tierProgress.next && tierProgress.neededForNext !== null && (
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
              {tierProgress.neededForNext > 0 ? (
                <>Earn <strong>{tierProgress.neededForNext.toLocaleString()}</strong> more lifetime coins to reach <strong>{tierProgress.next}</strong> ({Math.round(tierProgress.percentToNext)}% of the way there).</>
              ) : (
                <>You're eligible for the next tier upgrade.</>
              )}
            </p>
          )}

          {/* Progress bar */}
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
              <span>Standard</span>
              <span>Bronze</span>
              <span>Silver</span>
              <span>Gold</span>
              <span>Platinum</span>
              <span>Diamond</span>
              <span>Olympus</span>
            </div>
            <div style={{ position: "relative", height: 10, borderRadius: 999, background: "rgba(15,23,42,0.9)", overflow: "hidden", border: "1px solid rgba(148,163,184,0.6)" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#22c55e,#eab308,#f97316,#a855f7)", width: `${progressPercent}%`, transformOrigin: "left center", transition: "width 0.6s ease-out" }} />
            </div>
          </div>

          {/* Perk summary */}
          <ul style={{ margin: 0, marginTop: 6, paddingLeft: 18, fontSize: 12, color: "#d1d5db", display: "grid", gap: 4 }}>
            <li><strong>Standard:</strong> 1 daily spin. Welcome to Zeus Lounge.</li>
            <li><strong>Bronze</strong> (3,000 coins): 2 daily spins + access to special coin promos.</li>
            <li><strong>Silver</strong> (8,000 coins): 3 daily spins + 50% off platform redeem fees.</li>
            <li><strong>Gold</strong> (20,000 coins): 4 daily spins + 100% platform redeem fee coverage.</li>
            <li><strong>Platinum</strong> (50,000 coins): 5 daily spins + 100% fees + 5% match on deposits over $50.</li>
            <li><strong>Diamond</strong> (120,000 coins): 6 daily spins + 100% fees + 10% match on deposits over $50.</li>
            <li><strong>Olympus</strong> (300,000 coins): 7 daily spins + 100% fees + 15% deposit match + monthly free play bonus.</li>
          </ul>
        </section>

      </div>
    </main>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
      <span style={{ color: "#9ca3af" }}>{props.label}</span>
      <span style={{ fontWeight: 500 }}>{props.value}</span>
    </div>
  );
}