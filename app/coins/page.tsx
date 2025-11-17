"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TxRow = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
};

export default function CoinHistoryPage() {
  const [coins, setCoins] = useState<number | null>(null);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: userData, error: userErr } =
          await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          setErr("You must be logged in to view your Zeus Coin history.");
          setLoading(false);
          return;
        }

        // Get current coin balance
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("zeus_coins")
          .eq("id", user.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        // Get transactions
        const { data: txData, error: txErr } = await supabase
          .from("coin_transactions")
          .select("id, amount, type, note, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (txErr) throw txErr;

        if (!mounted) return;
        setCoins(profileData?.zeus_coins ?? 0);
        setRows(txData || []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e.message || "Unable to load coin history.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
        Loading Zeus Coin ledger…
      </main>
    );
  }

  if (err) {
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
        <p>{err}</p>
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
          maxWidth: 960,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        {/* Header */}
        <header>
          <h1
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "2.1rem",
              margin: 0,
              background: "linear-gradient(to right, #FFD700, #FFF8DC)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 15px rgba(255,255,255,0.45)",
            }}
          >
            Zeus Coin Ledger
          </h1>
          <p style={{ marginTop: 8, color: "#d1d5db", fontSize: 14 }}>
            A record of how you&apos;ve earned and spent Zeus Coins.
          </p>
        </header>

        {/* Balance card */}
        <section
          style={{
            background: "rgba(0,0,0,0.7)",
            borderRadius: 16,
            border: "1px solid #eab308",
            boxShadow: "0 8px 30px rgba(0,0,0,0.7)",
            padding: 16,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#facc15",
              }}
            >
              Current Zeus Coins
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#fef9c3",
              }}
            >
              {balance.toLocaleString()}
            </div>
          </div>
          <p
            style={{
              margin: 0,
              maxWidth: 380,
              fontSize: 13,
              color: "#e5e7eb",
            }}
          >
            Positive amounts are coins added (deposits, Facebook, promos).
            Negative amounts are coins spent on Zeus Rewards.
          </p>
        </section>

        {/* Transactions list */}
        <section
          style={{
            background: "rgba(15,23,42,0.9)",
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.6)",
            padding: 14,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.3rem",
              margin: "0 0 8px",
              color: "#EED27A",
            }}
          >
            Recent Activity
          </h2>

          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#cbd5f5" }}>
              No coin activity yet. Once hosts start logging your deposits,
              Facebook interactions, and rewards, they will appear here.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 4,
              }}
            >
              {rows.map((row) => {
                const positive = row.amount > 0;
                const amountText = `${positive ? "+" : ""}${row.amount.toLocaleString()}`;
                const dateStr = new Date(row.created_at).toLocaleString();
                const typeLabel = formatType(row.type);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: "rgba(15,23,42,0.9)",
                      border: "1px solid rgba(55,65,81,0.9)",
                    }}
                  >
                    {/* Left: description */}
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#e5e7eb",
                        }}
                      >
                        {typeLabel}
                      </div>
                      {row.note && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                          }}
                        >
                          {row.note}
                        </div>
                      )}
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "#6b7280",
                        }}
                      >
                        {dateStr}
                      </div>
                    </div>

                    {/* Right: amount */}
                    <div
                      style={{
                        textAlign: "right",
                        fontFamily:
                          "var(--font-cinzel, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: positive ? "#bbf7d0" : "#fecaca",
                        }}
                      >
                        {amountText}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                        }}
                      >
                        Zeus Coins
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mobile hint */}
        <p
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          On mobile, scroll down to see your full Zeus Coin history.
        </p>
      </div>
    </main>
  );
}

function formatType(type: string): string {
  switch (type) {
    case "deposit":
      return "Deposit Reward";
    case "facebook_like":
      return "Facebook Like";
    case "facebook_comment":
      return "Facebook Comment";
    case "facebook_share":
      return "Facebook Share";
    case "group_post":
      return "Group Win Post";
    case "referral":
      return "Referral Bonus";
    case "reward_redeem":
      return "Reward Redemption";
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}