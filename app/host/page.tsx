"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type HostProfileRow = {
  is_host: boolean | null;
};

type SimpleUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  zeus_coins: number;
  referred_by: string | null;
  invite_code: string | null;
};

type SpinRow = {
  id: string;
  created_at: string;
  points_awarded: number;
  note: string | null;
};

type CoinTxRow = {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  note: string | null;
};

export default function HostConsolePage() {
  const router = useRouter();

  // --- Host gate state ---
  const [checkingHost, setCheckingHost] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);

  // --- Auth token for API calls ---
  const [authToken, setAuthToken] = useState<string | null>(null);

  // --- Player search / selection ---
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // --- Coins adjust ---
  const [coinsDelta, setCoinsDelta] = useState<number>(0);
  const [savingCoins, setSavingCoins] = useState(false);
  const [coinsMessage, setCoinsMessage] = useState<string | null>(null);

  // --- History ---
  const [spinHistory, setSpinHistory] = useState<SpinRow[]>([]);
  const [coinHistory, setCoinHistory] = useState<CoinTxRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ----------------------------
  // 1) HOST-ONLY ROUTE GUARD + GET ACCESS TOKEN
  // ----------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Get session (user + access token)
        const { data: sessionData, error: sessionErr } =
          await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;

        const session = sessionData.session;

        if (!session?.user) {
          if (!mounted) return;
          router.replace("/login");
          return;
        }

        // Save access token for API calls
        if (mounted) {
          setAuthToken(session.access_token ?? null);
        }

        // Check host flag in profiles
        const { data, error } = await supabase
          .from("profiles")
          .select("is_host")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        const profileRow = data as HostProfileRow | null;

        if (!profileRow?.is_host) {
          if (!mounted) return;
          setHostError("You do not have access to the Host Console.");
          setCheckingHost(false);
          return;
        }

        if (!mounted) return;
        setCheckingHost(false);
      } catch (e: any) {
        if (!mounted) return;
        setHostError(
          e?.message || "Unable to verify host permissions. Try again later."
        );
        setCheckingHost(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ----------------------------
  // 2) SEARCH PLAYER
  // ----------------------------
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchMessage(null);
    setUser(null);
    setSpinHistory([]);
    setCoinHistory([]);

    if (!search.trim()) {
      setSearchMessage("Enter a username or email to search.");
      return;
    }

    if (!authToken) {
      setSearchMessage("Missing Authorization bearer token. Please refresh.");
      return;
    }

    setSearching(true);
    try {
      const res = await fetch("/api/host/get-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ query: search.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Search failed.");
      }

      const users = (data.users || []) as SimpleUser[];

      if (users.length === 0) {
        setSearchMessage("No player found.");
        setUser(null);
      } else {
        setUser(users[0]);
        setSearchMessage(
          users.length > 1
            ? `Showing first of ${users.length} matches.`
            : null
        );
        void loadHistory(users[0].id);
      }
    } catch (e: any) {
      setSearchMessage(e?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  // ----------------------------
  // 3) LOAD HISTORY FOR USER
  // ----------------------------
  async function loadHistory(userId: string) {
    if (!authToken) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    try {
      const [spinsRes, coinsRes] = await Promise.all([
        fetch(`/api/host/spin-history?user_id=${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
        fetch(`/api/host/coin-history?user_id=${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
      ]);

      const spinJson = spinsRes.ok ? await spinsRes.json() : { rows: [] };
      const coinJson = coinsRes.ok ? await coinsRes.json() : { rows: [] };

      setSpinHistory(spinJson.rows || []);
      setCoinHistory(coinJson.rows || []);
    } catch {
      // Optional: set a visible error message
    } finally {
      setLoadingHistory(false);
    }
  }

  // ----------------------------
  // 4) APPLY COIN CHANGE
  // ----------------------------
  async function handleApplyCoins(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!coinsDelta) {
      setCoinsMessage("Enter a non-zero coin amount.");
      return;
    }

    if (!authToken) {
      setCoinsMessage("Missing Authorization bearer token. Please refresh.");
      return;
    }

    setSavingCoins(true);
    setCoinsMessage(null);
    try {
      const res = await fetch("/api/host/add-coins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          amount: coinsDelta,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Unable to update coins.");
      }

      // update local user balance
      setUser((prev) =>
        prev
          ? { ...prev, zeus_coins: (prev.zeus_coins || 0) + coinsDelta }
          : prev
      );
      setCoinsMessage("Coins updated and logged.");
      setCoinsDelta(0);
      void loadHistory(user.id);
    } catch (e: any) {
      setCoinsMessage(e?.message || "Failed to update coins.");
    } finally {
      setSavingCoins(false);
    }
  }

  // ----------------------------
  //  LOADING / ERROR STATES
  // ----------------------------
  if (checkingHost) {
    return (
      <main
        style={{
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
          background: "#000",
          color: "#fff",
        }}
      >
        Verifying host access…
      </main>
    );
  }

  if (hostError) {
    return (
      <main
        style={{
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#000",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <p>{hostError}</p>
      </main>
    );
  }

  // ----------------------------
  //  MAIN HOST CONSOLE UI
  // ----------------------------
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050510",
        color: "#f9fafb",
        padding: "96px 16px 32px",
        fontFamily:
          "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        {/* HEADER */}
        <header>
          <h1
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "2rem",
              marginBottom: 4,
              color: "#fbbf24",
            }}
          >
            Zeus Host Console
          </h1>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
            Search a player, adjust Zeus Coins, and review their recent
            activity.
          </p>
        </header>

        {/* 1. SEARCH PLAYER */}
        <section
          style={{
            borderRadius: 16,
            background:
              "radial-gradient(circle at top, rgba(250,204,21,0.15), transparent 60%)",
            border: "1px solid rgba(250,204,21,0.35)",
            padding: "16px 18px",
            display: "grid",
            gap: 12,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontFamily: "var(--font-cinzel), serif",
            }}
          >
            1. Find Player
          </h2>
          <form
            onSubmit={handleSearch}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Search by username or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
            <button
              type="submit"
              disabled={searching}
              style={{
                padding: "9px 14px",
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(90deg, #facc15, #f97316, #ea580c)",
                color: "#111827",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                minWidth: 120,
              }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchMessage && (
            <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb" }}>
              {searchMessage}
            </p>
          )}
        </section>

        {/* 2. PLAYER OVERVIEW + 3. COINS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.1fr)",
            gap: 16,
          }}
        >
          {/* Player card */}
          <div
            style={{
              borderRadius: 16,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.6)",
              padding: "14px 16px",
              minHeight: 140,
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: 16,
                fontFamily: "var(--font-cinzel), serif",
              }}
            >
              2. Player Overview
            </h2>
            {!user ? (
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                Search for a player to view their details.
              </p>
            ) : (
              <div style={{ fontSize: 14, display: "grid", gap: 4 }}>
                <div>
                  <strong>Name:</strong>{" "}
                  {user.first_name || user.last_name
                    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                    : "—"}
                </div>
                <div>
                  <strong>Username:</strong> {user.username || "—"}
                </div>
                <div>
                  <strong>Zeus Coins:</strong>{" "}
                  {user.zeus_coins?.toLocaleString() ?? 0}
                </div>
                <div>
                  <strong>Invite Code:</strong> {user.invite_code || "—"}
                </div>
              </div>
            )}
          </div>

          {/* Coins editor */}
          <div
            style={{
              borderRadius: 16,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.6)",
              padding: "14px 16px",
              minHeight: 140,
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: 16,
                fontFamily: "var(--font-cinzel), serif",
              }}
            >
              3. Adjust Zeus Coins
            </h2>
            {!user ? (
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                Select a player first.
              </p>
            ) : (
              <form
                onSubmit={handleApplyCoins}
                style={{
                  display: "grid",
                  gap: 8,
                  alignItems: "center",
                  gridTemplateColumns: "minmax(0, 1.1fr) auto",
                }}
              >
                <input
                  type="number"
                  value={coinsDelta}
                  onChange={(e) => setCoinsDelta(Number(e.target.value))}
                  placeholder="e.g. 500 or -500"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                  }}
                />
                <button
                  type="submit"
                  disabled={savingCoins}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "none",
                    background:
                      "linear-gradient(90deg, #22c55e, #16a34a, #15803d)",
                    color: "#022c22",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    minWidth: 120,
                  }}
                >
                  {savingCoins ? "Saving…" : "Apply"}
                </button>
                {coinsMessage && (
                  <p
                    style={{
                      gridColumn: "1 / -1",
                      margin: 0,
                      fontSize: 13,
                      color: "#e5e7eb",
                    }}
                  >
                    {coinsMessage}
                  </p>
                )}
              </form>
            )}
          </div>
        </section>

        {/* 4. HISTORY */}
        <section
          style={{
            borderRadius: 16,
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.6)",
            padding: "14px 16px",
            display: "grid",
            gap: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontFamily: "var(--font-cinzel), serif",
            }}
          >
            4. Recent Activity
          </h2>
          {!user ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
              Select a player to view spins and coin changes.
            </p>
          ) : loadingHistory ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
              Loading history…
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.1fr)",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 6,
                    fontSize: 14,
                    color: "#e5e7eb",
                  }}
                >
                  Daily Spins
                </h3>
                {spinHistory.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                    No spins logged yet.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      fontSize: 13,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    {spinHistory.map((row) => (
                      <li key={row.id}>
                        {new Date(row.created_at).toLocaleString()} –{" "}
                        {row.points_awarded} pts{" "}
                        {row.note ? `(${row.note})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 6,
                    fontSize: 14,
                    color: "#e5e7eb",
                  }}
                >
                  Coin Transactions
                </h3>
                {coinHistory.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                    No coin transactions yet.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      fontSize: 13,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    {coinHistory.map((row) => (
                      <li key={row.id}>
                        {new Date(row.created_at).toLocaleString()} –{" "}
                        {row.amount > 0 ? "+" : ""}
                        {row.amount} ({row.type}
                        {row.note ? ` – ${row.note}` : ""})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}