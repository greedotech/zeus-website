"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Reward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  note: string; // saved in coin_transactions/redemptions
};

type RedemptionRow = {
  id: string;
  reward: string;
  cost: number;
  created_at: string;
};

const REWARDS: Reward[] = [
  {
    id: "match25",
    name: "25% Match up to $20",
    description: "Great warm-up bonus for smaller deposits.",
    cost: 3000,
    note: "25% match up to $20",
  },
  {
    id: "match50",
    name: "50% Match up to $40",
    description: "Stronger boost for mid-range deposits.",
    cost: 6000,
    note: "50% match up to $40",
  },
  {
    id: "match100",
    name: "100% Match up to $40",
    description: "Double your qualifying deposit, once applied by a host.",
    cost: 10000,
    note: "100% match up to $40",
  },
  {
    id: "free10",
    name: "$10 Free Play",
    description: "Perfect little Zeus spark for a quick session.",
    cost: 8000,
    note: "$10 free play credit",
  },
  {
    id: "free25",
    name: "$25 Free Play",
    description: "More time on the reels, more chances to hit.",
    cost: 18000,
    note: "$25 free play credit",
  },
  {
    id: "free50",
    name: "$50 Free Play",
    description: "Extended Olympus session for serious contenders.",
    cost: 35000,
    note: "$50 free play credit",
  },
];

export default function RewardsPage() {
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<RedemptionRow[]>([]);

  // Load profile coins + redemption history
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: userData, error: userErr } =
          await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          setError("You must be logged in to view Zeus Rewards.");
          setLoading(false);
          return;
        }

        // get coins
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("zeus_coins")
          .eq("id", user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;

        if (mounted) {
          setCoins(profileData?.zeus_coins ?? 0);
        }

        // get last redemptions
        const { data: redeemRows, error: redeemErr } = await supabase
          .from("redemptions")
          .select("id, reward, cost, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (redeemErr) throw redeemErr;

        if (mounted) {
          setHistory(redeemRows || []);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e.message || "Unable to load Zeus Rewards.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleRedeem(reward: Reward) {
    setError(null);
    setMessage(null);

    if (coins === null) return;
    if (coins < reward.cost) {
      setError("Not enough Zeus Coins for that reward yet.");
      return;
    }

    const confirmText = `Redeem "${reward.name}" for ${reward.cost.toLocaleString()} Zeus Coins?`;
    if (typeof window !== "undefined" && !window.confirm(confirmText)) return;

    setRedeemingId(reward.id);
    try {
      const { data: userData, error: userErr } =
        await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        throw new Error("You must be logged in.");
      }

      // re-fetch latest coins to reduce race issues
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("zeus_coins")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      const currentCoins = profileData?.zeus_coins ?? 0;
      if (currentCoins < reward.cost) {
        throw new Error(
          "Your coin balance changed — not enough coins for this reward."
        );
      }

      const newBalance = currentCoins - reward.cost;

      // 1) Update profile coins
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ zeus_coins: newBalance })
        .eq("id", user.id);
      if (updateErr) throw updateErr;

      // 2) Log negative transaction (backend tracking)
      const { error: txErr } = await supabase.from("coin_transactions").insert({
        user_id: user.id,
        amount: -reward.cost,
        type: "reward_redeem",
        note: reward.note,
      });
      if (txErr) throw txErr;

      // 3) Log redemption record (for reporting)
      const { data: redemptionRow, error: redeemErr } = await supabase
        .from("redemptions")
        .insert({
          user_id: user.id,
          reward: reward.name,
          cost: reward.cost,
        })
        .select("id, reward, cost, created_at")
        .single();

      if (redeemErr) throw redeemErr;

      // locally update state
      setCoins(newBalance);
      setHistory((prev) => [redemptionRow, ...prev].slice(0, 10));
      setMessage(
        `Redeemed "${reward.name}". A host will apply it on your next session.`
      );
    } catch (e: any) {
      setError(e.message || "Unable to redeem reward.");
    } finally {
      setRedeemingId(null);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "60vh",
          background: "#000",
          color: "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        Loading Zeus Rewards…
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: "60vh",
          background: "#000",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          padding: 16,
          textAlign: "center",
        }}
      >
        <p>{error}</p>
      </main>
    );
  }

  const balance = coins ?? 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#f9fafb",
        padding: "84px 16px 32px",
        fontFamily:
          "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        {/* Scroll wrapper */}
        <div
          style={{
            position: "relative",
            padding: "2.4rem 1.6rem 2rem",
            borderRadius: 18,
            background:
              "linear-gradient(180deg, #fdf3d7, #f5e3b8 40%, #e7cf9b 80%)",
            boxShadow:
              "0 18px 60px rgba(0,0,0,0.7), 0 0 40px rgba(250,204,21,0.35)",
            color: "#2b210f",
            overflow: "hidden",
          }}
        >
          {/* Scroll edges */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 18,
              boxShadow:
                "inset 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 22px rgba(0,0,0,0.35)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -40,
              top: -14,
              width: 80,
              height: 32,
              borderRadius: 999,
              background:
                "radial-gradient(circle at 50% 50%, #a16207, #4a2500 70%)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -40,
              top: -14,
              width: 80,
              height: 32,
              borderRadius: 999,
              background:
                "radial-gradient(circle at 50% 50%, #a16207, #4a2500 70%)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -40,
              bottom: -14,
              width: 80,
              height: 32,
              borderRadius: 999,
              background:
                "radial-gradient(circle at 50% 50%, #a16207, #4a2500 70%)",
              boxShadow: "0 -8px 20px rgba(0,0,0,0.6)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -40,
              bottom: -14,
              width: 80,
              height: 32,
              borderRadius: 999,
              background:
                "radial-gradient(circle at 50% 50%, #a16207, #4a2500 70%)",
              boxShadow: "0 -8px 20px rgba(0,0,0,0.6)",
            }}
          />

          {/* Header inside scroll */}
          <header style={{ marginBottom: 18, position: "relative", zIndex: 1 }}>
            <h1
              style={{
                fontFamily: "var(--font-cinzel), serif",
                fontSize: "2.2rem",
                margin: 0,
                marginBottom: 4,
                color: "#3f2705",
                textShadow:
                  "0 0 8px rgba(255,255,255,0.5), 0 0 16px rgba(250,204,21,0.45)",
              }}
            >
              Zeus Rewards Scroll
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "#5b4630",
              }}
            >
              Earn Zeus Coins by depositing, playing, and engaging with Zeus
              Lounge — then redeem them for match bonuses and free play.
            </p>
          </header>

          {/* Coin balance */}
          <section
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(120,53,15,0.6)",
                background:
                  "radial-gradient(circle at 0 0, rgba(250,204,21,0.25), transparent 60%)",
                minWidth: 190,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#6b4b23",
                }}
              >
                Current Balance
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#1f2937",
                }}
              >
                {balance.toLocaleString()}{" "}
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  Zeus Coins
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: "#6b4b23",
                }}
              >
                Your total updates whenever a host logs a deposit bonus,
                community reward, or redemption.
              </div>
            </div>

            {(message || error) && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: error ? "#b91c1c" : "#166534",
                  maxWidth: 360,
                }}
              >
                {error || message}
              </p>
            )}
          </section>

          {/* 2-column content on desktop, stacked on mobile */}
          <section
            className="rewards-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.2fr)",
              gap: 16,
            }}
          >
            {/* Left: How to earn coins */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* Deposit rules */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(254,243,199,0.8), rgba(252,211,77,0.6))",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid rgba(180,83,9,0.35)",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 4px",
                    fontSize: 15,
                    fontFamily: "var(--font-cinzel), serif",
                    color: "#78350f",
                  }}
                >
                  Earn Coins from Deposits
                </h2>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 13,
                    color: "#4b2f0a",
                  }}
                >
                  Hosts award Zeus Coins whenever a qualifying deposit is
                  completed:
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 13,
                    color: "#4b2f0a",
                  }}
                >
                  <li>
                    $10 – $24.99 → <strong>600</strong> Zeus Coins
                  </li>
                  <li>
                    $25 – $49.99 → <strong>1,500</strong> Zeus Coins
                  </li>
                  <li>
                    $50 – $99.99 → <strong>3,500</strong> Zeus Coins
                  </li>
                  <li>
                    $100+ → <strong>8,000</strong> Zeus Coins
                  </li>
                </ul>
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "#6b4b23",
                  }}
                >
                  Each award is logged in the system so your balance is always
                  up to date.
                </p>
              </div>

              {/* Facebook & community rules */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(249,250,251,0.9), rgba(229,231,235,0.9))",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid rgba(148,163,184,0.7)",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 4px",
                    fontSize: 15,
                    fontFamily: "var(--font-cinzel), serif",
                    color: "#111827",
                  }}
                >
                  Earn Coins on Facebook & in the Group
                </h2>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  Coins are awarded for <strong>meaningful</strong> interaction.
                  A host may ask for screenshots or verify your activity:
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 13,
                    color: "#1f2937",
                  }}
                >
                  <li>
                    Like a Zeus Lounge post → <strong>10</strong> coins
                  </li>
                  <li>
                    Comment on a Zeus Lounge post → <strong>20</strong> coins
                  </li>
                  <li>
                    Share a Zeus Lounge post publicly →{" "}
                    <strong>40</strong> coins
                  </li>
                  <li>
                    Post a win screenshot in the group →{" "}
                    <strong>80</strong> coins
                  </li>
                  <li>
                    Refer a friend who makes their first deposit →{" "}
                    <strong>500</strong> coins
                  </li>
                </ul>
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "#4b5563",
                  }}
                >
                  To claim: message a host with your screenshots and your Zeus
                  Lounge username. Hosts log the coins under your account.
                </p>
              </div>
            </div>

            {/* Right: rewards list + history */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* Rewards */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(251,245,222,0.9), rgba(250,232,195,0.95))",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid rgba(180,83,9,0.35)",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: 15,
                    fontFamily: "var(--font-cinzel), serif",
                    color: "#78350f",
                  }}
                >
                  Redeem Zeus Coins
                </h2>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 13,
                    color: "#4b2f0a",
                  }}
                >
                  Choose a reward below. Zeus Coins are removed instantly, and a
                  host applies the bonus on your next visit.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {REWARDS.map((reward) => {
                    const affordable = balance >= reward.cost;
                    const busy = redeemingId === reward.id;
                    return (
                      <div
                        key={reward.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: affordable
                            ? "rgba(254,249,195,0.9)"
                            : "rgba(229,231,235,0.8)",
                          border: "1px solid rgba(120,53,15,0.4)",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 8,
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#433024",
                            }}
                          >
                            {reward.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#5b4630",
                            }}
                          >
                            {reward.description}
                          </div>
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: 12,
                              color: "#92400e",
                              fontWeight: 600,
                            }}
                          >
                            Cost:{" "}
                            {reward.cost.toLocaleString()} Zeus Coins
                          </div>
                        </div>
                        <button
                          onClick={() => handleRedeem(reward)}
                          disabled={!affordable || busy}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 999,
                            border: "none",
                            background: affordable
                              ? "linear-gradient(90deg, #fbbf24, #f97316)"
                              : "#9ca3af",
                            color: affordable ? "#111827" : "#f3f4f6",
                            fontSize: 12,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            cursor:
                              affordable && !busy
                                ? "pointer"
                                : "default",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {busy
                            ? "Processing..."
                            : affordable
                            ? "Redeem"
                            : "Need coins"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* History */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(243,244,246,0.95), rgba(229,231,235,0.95))",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid rgba(148,163,184,0.7)",
                  fontSize: 12,
                  color: "#111827",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 4px",
                    fontSize: 14,
                    fontFamily: "var(--font-cinzel), serif",
                    color: "#111827",
                  }}
                >
                  Recent Redemptions
                </h2>
                {history.length === 0 ? (
                  <p style={{ margin: 0 }}>
                    No rewards redeemed yet. Build your coins and claim your
                    first Olympus bonus.
                  </p>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                    }}
                  >
                    {history.map((r) => (
                      <li key={r.id} style={{ marginBottom: 2 }}>
                        <strong>{r.reward}</strong> –{" "}
                        {r.cost.toLocaleString()} coins on{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Mobile hint below scroll */}
        <p
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          On mobile, scroll the parchment to read how coins work and tap a
          reward to redeem.
        </p>
      </div>

      {/* Mobile layout: stack the 2 columns */}
      <style jsx>{`
        @media (max-width: 768px) {
          .rewards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}