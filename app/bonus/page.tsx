"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getTierProgress, getTierLabel } from "@/lib/tiers";


type ProfileBits = {
  id: string;
  zeus_coins: number | null;
};

type SpinResult = {
  label: string;
  reward: number;
};

export default function BonusPage() {
  const [profile, setProfile] = useState<ProfileBits | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);

  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);

  // --- Load minimal profile (coins) to show tier + perks ---
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) {
          console.error("bonus page – session error:", sessionErr);
          if (!mounted) return;
          setProfile(null);
          return;
        }

        const user = session?.user;
        if (!user) {
          if (!mounted) return;
          setProfile(null);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, zeus_coins")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!mounted) return;
        setProfile({
          id: user.id,
          zeus_coins: data?.zeus_coins ?? 0,
        });
      } catch (e) {
        console.error("bonus page – profile load error:", e);
        if (!mounted) return;
        setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []); // ✅ do NOT depend on `supabase`

  // --- Derived tier info ---
  const coins = profile?.zeus_coins ?? 0;
  const tierProgress = getTierProgress(coins);
  const tierLabel = getTierLabel(tierProgress.current);

  const handleSpin = async () => {
    if (spinning) return;
    setError(null);
    setMessage(null);

    if (cooldownUntil && cooldownUntil.getTime() > Date.now()) {
      setError(
        `You already spun today. Next spin: ${cooldownUntil.toLocaleString()}`
      );
      return;
    }

    setSpinning(true);

    const extraTurns = 5 + Math.floor(Math.random() * 4);
    const finalRotation =
      wheelRotation + extraTurns * 360 + Math.random() * 360;
    setWheelRotation(finalRotation);

    try {
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr) {
        console.error("daily spin – session error:", sessionErr);
        setResult(null);
        setError("Please log in again to spin.");
        return;
      }

      if (!session?.user) {
        setResult(null);
        setError("Please log in to spin.");
        return;
      }

      // ✅ cookies authenticate this route
      const res = await fetch("/api/bonus/daily", { method: "POST" });
      const json = await res.json().catch(() => ({} as any));

      if (res.status === 429) {
        setResult(null);
        setError("You’ve already taken today’s spin.");
        if (json.cooldownEndsAt) {
          const d = new Date(json.cooldownEndsAt);
          setCooldownUntil(d);
          setMessage(`Next spin available at ${d.toLocaleString()}.`);
        }
        return;
      }

      if (!res.ok) {
        setResult(null);
        setError(json.error || "Failed to record daily spin.");
        return;
      }

      const rewardValue = json.value ?? json.reward ?? 0;
      const rewardType = json.type ?? "none";

      const r: SpinResult = {
        reward: rewardValue,
        label: json.label ?? "Spin complete",
      };
      setResult(r);

      if (rewardType === "coins" && rewardValue > 0) {
        setMessage(`Nice! You won ${rewardValue} Zeus Coins.`);
      } else {
        setMessage(`Result: ${r.label}`);
      }

      // refresh coins if coin win
      if (profile && rewardType === "coins" && rewardValue > 0) {
        try {
          const { data: refreshed, error: refErr } = await supabase
            .from("profiles")
            .select("zeus_coins")
            .eq("id", profile.id)
            .maybeSingle();

          if (!refErr && refreshed) {
            setProfile({
              id: profile.id,
              zeus_coins: refreshed.zeus_coins ?? profile.zeus_coins ?? 0,
            });
          } else {
            setProfile({
              ...profile,
              zeus_coins: (profile.zeus_coins ?? 0) + rewardValue,
            });
          }
        } catch {
          setProfile({
            ...profile,
            zeus_coins: (profile.zeus_coins ?? 0) + rewardValue,
          });
        }
      }
    } catch (e: any) {
      console.error("daily spin – client error:", e);
      setResult(null);
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setTimeout(() => setSpinning(false), 2200);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "90px 16px 32px",
        background: "radial-gradient(circle at top, #020617, #000)",
        color: "#f9fafb",
        fontFamily:
          "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "2.4rem",
              margin: 0,
              background: "linear-gradient(to right, #facc15, #fb923c)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Daily Zeus Spin
          </h1>
          <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 14 }}>
            Come back every day for a free spin and a chance at extra Zeus Coins.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          }}
        >
          <div
            style={{
              background: "rgba(15,23,42,0.9)",
              borderRadius: 18,
              border: "1px solid rgba(251,191,36,0.6)",
              padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              display: "grid",
              gap: 16,
              justifyItems: "center",
            }}
          >
            <div style={{ position: "relative", width: 260, height: 260, display: "grid", placeItems: "center" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "999px",
                  boxShadow: "0 0 40px rgba(250,204,21,0.35)",
                  opacity: 0.7,
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: -6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "10px solid transparent",
                  borderRight: "10px solid transparent",
                  borderBottom: "18px solid #facc15",
                  filter: "drop-shadow(0 0 8px rgba(250,204,21,0.8))",
                  zIndex: 3,
                }}
              />

              <div
                style={{
                  position: "relative",
                  width: 220,
                  height: 220,
                  borderRadius: "999px",
                  background:
                    "conic-gradient(" +
                    "#facc15 0deg 24deg," +
                    "#22c55e 24deg 48deg," +
                    "#38bdf8 48deg 72deg," +
                    "#a855f7 72deg 96deg," +
                    "#f97316 96deg 120deg," +
                    "#facc15 120deg 144deg," +
                    "#22c55e 144deg 168deg," +
                    "#38bdf8 168deg 192deg," +
                    "#a855f7 192deg 216deg," +
                    "#f97316 216deg 240deg," +
                    "#facc15 240deg 264deg," +
                    "#22c55e 264deg 288deg," +
                    "#38bdf8 288deg 312deg," +
                    "#a855f7 312deg 336deg," +
                    "#f97316 336deg 360deg" +
                    ")",
                  border: "6px solid #111827",
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: spinning
                    ? "transform 2.2s cubic-bezier(0.15, 0.8, 0.25, 1)"
                    : "transform 0.4s ease-out",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: "999px",
                    background: "rgba(0,0,0,0.85)",
                    border: "3px solid rgba(0,0,0,0.6)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 0 20px rgba(250,204,21,0.6)",
                  }}
                >
                  <img
                    src="/images/logo.jpg"
                    alt="Zeus Lounge"
                    style={{
                      width: "80%",
                      height: "80%",
                      objectFit: "contain",
                      filter: "drop-shadow(0 0 8px rgba(250,204,21,0.75))",
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              style={{
                padding: "10px 26px",
                borderRadius: 999,
                border: "none",
                background: spinning
                  ? "linear-gradient(90deg, #6b7280, #4b5563)"
                  : "linear-gradient(90deg, #facc15, #fb923c, #f97316)",
                color: "#111827",
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                cursor: spinning ? "default" : "pointer",
                boxShadow: spinning ? "none" : "0 12px 25px rgba(248, 250, 252, 0.3)",
                minWidth: 200,
              }}
            >
              {spinning ? "Spinning…" : "Tap to Spin"}
            </button>

            <div style={{ textAlign: "center", minHeight: 40 }}>
              {error && <p style={{ margin: 0, fontSize: 13, color: "#fecaca" }}>{error}</p>}
              {message && <p style={{ margin: 0, fontSize: 13, color: "#bbf7d0" }}>{message}</p>}
              {result && !error && (
                <p style={{ marginTop: 6, fontSize: 13, color: "#e5e7eb" }}>
                  Result: <strong>{result.label}</strong>{" "}
                  {result.reward > 0 && `(+${result.reward} Zeus Coins)`}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <article
              style={{
                background: "rgba(15,23,42,0.9)",
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.6)",
                padding: 16,
                fontSize: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: 8,
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: 16,
                  color: "#e5e7eb",
                }}
              >
                Daily Spin Rules
              </h2>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: "#d1d5db",
                  display: "grid",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <li>One free spin every 24 hours per player account.</li>
                <li>Rewards are granted immediately when your spin completes.</li>
                <li>Possible outcomes include Zeus Coin wins, match bonuses, or free play prizes.</li>
                <li>Zeus Coins can be used toward redeems and special promotions based on your account tier.</li>
              </ul>
              <p style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
                Abuse, multiple accounts, or bonus misuse may result in removal of free spin access or Zeus Coins.
              </p>
            </article>

            <article
              style={{
                background: "rgba(12,20,35,0.95)",
                borderRadius: 16,
                border: "1px solid rgba(59,130,246,0.7)",
                padding: 16,
                fontSize: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: 8,
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: 16,
                  color: "#bfdbfe",
                }}
              >
                Your Zeus Tier & Perks
              </h2>

              {loadingProfile ? (
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                  Loading your coins and tier…
                </p>
              ) : !profile ? (
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                  Log in to see your tier and bonus perks.
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, marginBottom: 4, fontSize: 13, color: "#e5e7eb" }}>
                    Current tier:{" "}
                    <strong style={{ color: "#facc15" }}>
                      {tierProgress.current} — {tierLabel}
                    </strong>
                  </p>
                  <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#9ca3af" }}>
                    Zeus Coins: {coins.toLocaleString()}
                  </p>

                  {tierProgress.next && tierProgress.neededForNext !== null && (
                    <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                      {tierProgress.neededForNext! > 0 ? (
                        <>
                          Earn{" "}
                          <strong>{tierProgress.neededForNext!.toLocaleString()}</strong>{" "}
                          more Zeus Coins to reach <strong>{tierProgress.next}</strong>.
                        </>
                      ) : (
                        <>Eligible for next tier upgrade.</>
                      )}
                    </p>
                  )}

                  <ul
                    style={{
                      marginTop: 10,
                      marginBottom: 0,
                      paddingLeft: 18,
                      fontSize: 12,
                      color: "#d1d5db",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <li><strong>Standard:</strong> 1 free daily Zeus Spin, standard redeem fees apply.</li>
                    <li><strong>Bronze:</strong> Extra daily spin + access to special coin promos.</li>
                    <li><strong>Silver:</strong> Extra daily spin + we cover <strong>50% of platform redeem fees</strong>.</li>
                    <li><strong>Gold:</strong> Extra daily spin + we cover <strong>100% of platform redeem fees</strong>.</li>
                    <li><strong>Platinum:</strong> More spins + 100% fees + <strong>5% match on deposits over $50</strong>.</li>
                    <li><strong>Diamond:</strong> Max spins + 100% fees + <strong>10% match on deposits over $50</strong>.</li>
                  </ul>
                </>
              )}
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}