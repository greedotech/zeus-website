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
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          if (!mounted) return;
          setProfile(null);
          setLoadingProfile(false);
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
      } catch {
        if (!mounted) return;
        setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // --- Derived tier info ---
  const coins = profile?.zeus_coins ?? 0;
  const tierProgress = getTierProgress(coins);
  const tierLabel = getTierLabel(tierProgress.current);

  // --- Handle spin (with auth token) ---
  const handleSpin = async () => {
    if (spinning) return;
    setError(null);
    setMessage(null);

    // Cooldown already active (from earlier response)
    if (cooldownUntil && cooldownUntil.getTime() > Date.now()) {
      setError(
        `You already spun today. Next spin: ${cooldownUntil.toLocaleString()}`
      );
      return;
    }

    setSpinning(true);

    try {
      // 0) Make sure we have a logged-in session + access token
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        setError("Please log in to use the Daily Zeus Spin.");
        setSpinning(false);
        return;
      }
      const token = data.session.access_token;

      // 1) Give the wheel a big spin visually
      const extraTurns = 5 + Math.floor(Math.random() * 4); // 5–8 full turns
      const finalRotation =
        wheelRotation + extraTurns * 360 + Math.random() * 360;
      setWheelRotation(finalRotation);

      // 2) Call the API with Authorization header
      const res = await fetch("/api/bonus/daily", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 429) {
        // cooldown
        setResult(null);
        setError("You’ve already taken today’s spin.");
        if (json.cooldownEndsAt) {
          const d = new Date(json.cooldownEndsAt);
          setCooldownUntil(d);
          setMessage(`Next spin available at ${d.toLocaleString()}.`);
        }
      } else if (!res.ok) {
        setResult(null);
        setError(json.error || "Failed to record daily spin.");
      } else {
        // success
        const r: SpinResult = {
          reward: json.reward ?? 0,
          label: json.label ?? "Spin complete",
        };
        setResult(r);

        if (r.reward > 0) {
          setMessage(`Nice! You won ${r.reward} Zeus Coins.`);
        } else {
          setMessage(`Result: ${r.label}`);
        }

        // Update coins locally so the tier UI updates
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                zeus_coins: (prev.zeus_coins ?? 0) + r.reward,
              }
            : prev
        );
      }
    } catch {
      setResult(null);
      setError("Something went wrong. Please try again.");
    } finally {
      // let the wheel finish spinning visually before re-enabling
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
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        {/* HEADER */}
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

        {/* MAIN LAYOUT: Wheel + Rules / Tier */}
        <section
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          }}
        >
          {/* LEFT: Wheel + button + result */}
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
            {/* Wheel wrapper */}
            <div
              style={{
                position: "relative",
                width: 260,
                height: 260,
                display: "grid",
                placeItems: "center",
              }}
            >
              {/* Glow */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "999px",
                  boxShadow: "0 0 40px rgba(250,204,21,0.35)",
                  opacity: 0.7,
                }}
              />

              {/* Pointer */}
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

              {/* Wheel */}
              <div
                style={{
                  position: "relative",
                  width: 220,
                  height: 220,
                  borderRadius: "999px",
                  background:
                    "conic-gradient(#facc15 0deg 90deg, #22c55e 90deg 180deg, #38bdf8 180deg 270deg, #a855f7 270deg 360deg)",
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
                {/* Center disc */}
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: "999px",
                    background:
                      "radial-gradient(circle at 30% 20%, #fefce8, #facc15)",
                    border: "3px solid rgba(0,0,0,0.6)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 0 20px rgba(250,204,21,0.6)",
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#1f2937",
                    textAlign: "center",
                    padding: 6,
                  }}
                >
                  Zeus
                  <br />
                  Spin
                </div>

                {/* Segment labels (purely visual) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <WheelLabel text="No Win" angle={45} />
                  <WheelLabel text="+100" angle={135} />
                  <WheelLabel text="+250" angle={225} />
                  <WheelLabel text="+500" angle={315} />
                </div>
              </div>
            </div>

            {/* Spin button */}
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
                boxShadow: spinning
                  ? "none"
                  : "0 12px 25px rgba(248, 250, 252, 0.3)",
                minWidth: 200,
              }}
            >
              {spinning ? "Spinning…" : "Tap to Spin"}
            </button>

            {/* Messages */}
            <div style={{ textAlign: "center", minHeight: 40 }}>
              {error && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#fecaca",
                  }}
                >
                  {error}
                </p>
              )}
              {message && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#bbf7d0",
                  }}
                >
                  {message}
                </p>
              )}
              {result && !error && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "#e5e7eb",
                  }}
                >
                  Result: <strong>{result.label}</strong>{" "}
                  {result.reward > 0 && `(+${result.reward} Zeus Coins)`}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: Rules + Tier perks */}
          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {/* Rules card */}
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
                <li>
                  Possible outcomes: No win, +100, +250, or +500 Zeus Coins
                  (subject to change during promos).
                </li>
                <li>
                  Zeus Coins can be used toward redeems and special promotions
                  based on your account tier.
                </li>
              </ul>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                Abuse, multiple accounts, or bonus misuse may result in removal
                of free spin access or Zeus Coins at host discretion.
              </p>
            </article>

            {/* Tier perks card */}
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
                  <p
                    style={{
                      margin: 0,
                      marginBottom: 4,
                      fontSize: 13,
                      color: "#e5e7eb",
                    }}
                  >
                    Current tier:{" "}
                    <strong style={{ color: "#facc15" }}>
                      {tierProgress.current} — {tierLabel}
                    </strong>
                  </p>
                  <p
                    style={{
                      margin: 0,
                      marginBottom: 6,
                      fontSize: 12,
                      color: "#9ca3af",
                    }}
                  >
                    Zeus Coins: {coins.toLocaleString()}
                  </p>

                  {tierProgress.next && tierProgress.neededForNext !== null && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      {tierProgress.neededForNext! > 0 ? (
                        <>
                          Earn{" "}
                          <strong>
                            {tierProgress.neededForNext!.toLocaleString()}
                          </strong>{" "}
                          more Zeus Coins to reach{" "}
                          <strong>{tierProgress.next}</strong>.
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
                    <li>
                      <strong>Standard:</strong> No fees on deposits, standard
                      redeem fees apply.
                    </li>
                    <li>
                      <strong>Silver:</strong> We cover 50% of platform redeem
                      fees.
                    </li>
                    <li>
                      <strong>Gold:</strong> We cover 100% of platform redeem
                      fees.
                    </li>
                    <li>
                      <strong>Diamond:</strong> 100% of platform redeem fees +
                      5% match on deposits over $50.
                    </li>
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

/** Small helper to position text around the wheel */
function WheelLabel({ text, angle }: { text: string; angle: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `rotate(${angle}deg) translate(0, -42%)`,
        transformOrigin: "center bottom",
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-block",
          transform: `rotate(${-angle}deg)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}