"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type HostProfileRow = {
  is_host: boolean;
};

type FoundUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  zeus_coins: number | null;
  referred_by: string | null;
  invite_code: string | null;
};

type SpinRow = {
  id: string;
  spun_at: string;
  prize_label: string;
  prize_type: string;
  prize_value: number;
};

type TxRow = {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  note: string | null;
};

type GetUserResponse = {
  users?: FoundUser[];
  error?: string;
};

type HistorySpinsResponse = {
  spins?: SpinRow[];
  error?: string;
};

type HistoryTxResponse = {
  transactions?: TxRow[];
  error?: string;
};

type AdjustCoinsResponse = {
  newBalance?: number;
  error?: string;
};

export default function HostConsolePage() {
  const router = useRouter();

  const [loadingHost, setLoadingHost] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState<"username" | "email">("username");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<FoundUser[]>([]);

  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);

  const [deltaInput, setDeltaInput] = useState<string>("0");
  const [noteInput, setNoteInput] = useState<string>("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);

  const [spins, setSpins] = useState<SpinRow[]>([]);
  const [spinsLoading, setSpinsLoading] = useState(false);
  const [spinsError, setSpinsError] = useState<string | null>(null);

  const [txs, setTxs] = useState<TxRow[]>([]);
  const [txsLoading, setTxsLoading] = useState(false);
  const [txsError, setTxsError] = useState<string | null>(null);

  // ----------------- ROUTE PROTECTION: only hosts -----------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user = authData.user;
        if (!user) {
          // Not logged in → send to login
          router.replace("/login?next=/host");
          return;
        }

        const { data: profileRow, error: profileErr } = await supabase
          .from("profiles")
          .select<HostProfileRow>("is_host")
          .eq("id", user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;

        if (!profileRow?.is_host) {
          if (!mounted) return;
          setHostError("You do not have access to the Host Console.");
          setLoadingHost(false);
          return;
        }

        if (!mounted) return;
        setLoadingHost(false);
      } catch (e: any) {
        if (!mounted) return;
        setHostError(e.message || "Unable to verify host access.");
        setLoadingHost(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ----------------- SEARCH PLAYER -----------------
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setResults([]);
    setSelectedUser(null);
    setSpins([]);
    setTxs([]);

    const term = searchTerm.trim();
    if (!term) {
      setSearchError("Enter a username or email to search.");
      return;
    }

    setSearchLoading(true);
    try {
      const body =
        searchBy === "email" ? { email: term } : { username: term };

      const res = await fetch("/api/host/get-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as GetUserResponse;

      if (!res.ok || data.error) {
        setSearchError(data.error || "Failed to search player.");
        return;
      }

      const users = data.users || [];
      if (users.length === 0) {
        setSearchError("No players found with that query.");
        return;
      }

      setResults(users);
      setSelectedUser(users[0]);
      // When we pick the first user, load their history
      void loadHistory(users[0].id);
    } catch (e: any) {
      setSearchError(e.message || "Unexpected error while searching.");
    } finally {
      setSearchLoading(false);
    }
  }

  // when staff selects a different result in the list
  function handleSelectUser(id: string) {
    const user = results.find((u) => u.id === id) || null;
    setSelectedUser(user);
    setSpins([]);
    setTxs([]);
    if (user) {
      void loadHistory(user.id);
    }
  }

  // ----------------- LOAD HISTORY: spins + transactions -----------------
  async function loadHistory(userId: string) {
    // spins
    setSpinsLoading(true);
    setSpinsError(null);
    try {
      const res = await fetch("/api/host/get-spins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as HistorySpinsResponse;
      if (!res.ok || data.error) {
        setSpinsError(data.error || "Unable to load spin history.");
      } else {
        setSpins(data.spins || []);
      }
    } catch (e: any) {
      setSpinsError(e.message || "Unexpected error loading spins.");
    } finally {
      setSpinsLoading(false);
    }

    // coin txs
    setTxsLoading(true);
    setTxsError(null);
    try {
      const res2 = await fetch("/api/host/get-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data2 = (await res2.json()) as HistoryTxResponse;
      if (!res2.ok || data2.error) {
        setTxsError(data2.error || "Unable to load coin transactions.");
      } else {
        setTxs(data2.transactions || []);
      }
    } catch (e: any) {
      setTxsError(e.message || "Unexpected error loading transactions.");
    } finally {
      setTxsLoading(false);
    }
  }

  // ----------------- ADJUST COINS -----------------
  async function handleAdjustCoins() {
    if (!selectedUser) {
      setAdjustError("Select a player first.");
      return;
    }

    setAdjustError(null);
    setAdjustMsg(null);

    const raw = deltaInput.trim();
    if (!raw) {
      setAdjustError("Enter a coin adjustment amount.");
      return;
    }

    const delta = Number(raw);
    if (!Number.isFinite(delta) || delta === 0) {
      setAdjustError("Enter a non-zero numeric amount.");
      return;
    }

    setAdjustLoading(true);
    try {
      const res = await fetch("/api/host/adjust-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          delta,
          note: noteInput || null,
        }),
      });

      const data = (await res.json()) as AdjustCoinsResponse;

      if (!res.ok || data.error) {
        setAdjustError(data.error || "Failed to adjust coins.");
        return;
      }

      const newBalance = data.newBalance ?? null;

      // update selected user + list
      if (newBalance !== null) {
        setSelectedUser((prev) =>
          prev ? { ...prev, zeus_coins: newBalance } : prev
        );
        setResults((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id ? { ...u, zeus_coins: newBalance } : u
          )
        );
      }

      setAdjustMsg("Coins updated and logged.");
      setDeltaInput("0");
      setNoteInput("");

      // reload tx history to show the new entry
      await loadHistory(selectedUser.id);
    } catch (e: any) {
      setAdjustError(e.message || "Unexpected error adjusting coins.");
    } finally {
      setAdjustLoading(false);
    }
  }

  // ----------------- RENDER -----------------
  if (loadingHost) {
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
        Checking host access…
      </main>
    );
  }

  if (hostError) {
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
        <p>{hostError}</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "80px 16px 32px",
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
              fontSize: "2.2rem",
              margin: 0,
              background: "linear-gradient(to right, #facc15, #fde68a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 18px rgba(250,204,21,0.45)",
            }}
          >
            Zeus Host Console
          </h1>
          <p style={{ marginTop: 6, color: "#9ca3af", fontSize: 14 }}>
            Search players, adjust Zeus Coins, and review daily spins & coin
            history. Changes here update live in Supabase.
          </p>
        </header>

        {/* SEARCH PANEL */}
        <section
          style={{
            background: "rgba(15,23,42,0.95)",
            borderRadius: 16,
            border: "1px solid rgba(59,130,246,0.45)",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.3rem",
              margin: 0,
              color: "#bfdbfe",
            }}
          >
            1. Find a Player
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
            <select
              value={searchBy}
              onChange={(e) =>
                setSearchBy(e.target.value as "username" | "email")
              }
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: 14,
              }}
            >
              <option value="username">By username</option>
              <option value="email">By email</option>
            </select>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                searchBy === "username"
                  ? "Enter username (full or partial)…"
                  : "Enter full email…"
              }
              style={{
                flex: 1,
                minWidth: 180,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: 14,
              }}
            />

            <button
              type="submit"
              disabled={searchLoading}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "none",
                background: "#2563eb",
                color: "#e5e7eb",
                fontWeight: 700,
                fontSize: 14,
                cursor: searchLoading ? "default" : "pointer",
              }}
            >
              {searchLoading ? "Searching…" : "Search"}
            </button>
          </form>

          {searchError && (
            <p style={{ margin: 0, fontSize: 13, color: "#fca5a5" }}>
              {searchError}
            </p>
          )}

          {results.length > 0 && (
            <div
              style={{
                marginTop: 8,
                display: "grid",
                gap: 6,
                fontSize: 13,
              }}
            >
              <div style={{ color: "#9ca3af" }}>
                Results ({results.length}). Click to select a player.
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 4,
                  maxHeight: 160,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {results.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const name = [u.first_name, u.last_name]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u.id)}
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(148,163,184,0.6)",
                        background: isSelected ? "#1d4ed8" : "#020617",
                        color: isSelected ? "#e5e7eb" : "#e5e7eb",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong>{name || "(no name)"}</strong>{" "}
                        {u.username && (
                          <span style={{ color: "#93c5fd" }}>
                            @{u.username}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#93c5fd" }}>
                        Coins: {u.zeus_coins ?? 0}
                        {u.invite_code && (
                          <> • Invite: {u.invite_code}</>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* PLAYER SUMMARY + COINS ADJUST */}
        {selectedUser && (
          <section
            style={{
              background: "rgba(15,23,42,0.95)",
              borderRadius: 16,
              border: "1px solid rgba(234,179,8,0.6)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-cinzel), serif",
                fontSize: "1.3rem",
                margin: 0,
                color: "#facc15",
              }}
            >
              2. Player Summary & Zeus Coins
            </h2>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>Player</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {[selectedUser.first_name, selectedUser.last_name]
                    .filter(Boolean)
                    .join(" ") || "(no name)"}
                </div>
                {selectedUser.username && (
                  <div style={{ fontSize: 13, color: "#93c5fd" }}>
                    @{selectedUser.username}
                  </div>
                )}
                {selectedUser.invite_code && (
                  <div style={{ fontSize: 12, color: "#a855f7" }}>
                    Invite Code: {selectedUser.invite_code}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(250,204,21,0.7)",
                  background:
                    "radial-gradient(circle at 0 0, rgba(250,204,21,0.25), transparent 60%)",
                  minWidth: 180,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#facc15",
                  }}
                >
                  Zeus Coins
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: "#fef9c3",
                  }}
                >
                  {(selectedUser.zeus_coins ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(51,65,85,0.7)",
                marginTop: 8,
                paddingTop: 8,
                display: "grid",
                gap: 8,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontFamily: "var(--font-cinzel), serif",
                  color: "#e5e7eb",
                }}
              >
                Adjust Zeus Coins
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                Enter a positive amount to add coins, or a negative amount to
                remove coins. This is logged in <code>coin_transactions</code>.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  value={deltaInput}
                  onChange={(e) => setDeltaInput(e.target.value)}
                  style={{
                    width: 130,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: 14,
                  }}
                />
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Note (e.g., deposit bonus, manual correction)…"
                  style={{
                    flex: 1,
                    minWidth: 180,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={handleAdjustCoins}
                  disabled={adjustLoading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "#facc15",
                    color: "#111827",
                    fontWeight: 800,
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    cursor: adjustLoading ? "default" : "pointer",
                  }}
                >
                  {adjustLoading ? "Updating…" : "Apply Change"}
                </button>
              </div>

              {adjustError && (
                <p style={{ margin: 0, fontSize: 13, color: "#fca5a5" }}>
                  {adjustError}
                </p>
              )}
              {adjustMsg && (
                <p style={{ margin: 0, fontSize: 13, color: "#86efac" }}>
                  {adjustMsg}
                </p>
              )}
            </div>
          </section>
        )}

        {/* HISTORY: only show when a user is selected */}
        {selectedUser && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.1fr)",
              gap: 16,
            }}
          >
            {/* Spins */}
            <div
              style={{
                background: "rgba(15,23,42,0.95)",
                borderRadius: 16,
                border: "1px solid rgba(96,165,250,0.7)",
                padding: 12,
                fontSize: 13,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: 6,
                  fontSize: 14,
                  fontFamily: "var(--font-cinzel), serif",
                  color: "#bfdbfe",
                }}
              >
                Recent Daily Spins
              </h2>
              {spinsLoading && <p>Loading spins…</p>}
              {spinsError && (
                <p style={{ color: "#fca5a5" }}>{spinsError}</p>
              )}
              {!spinsLoading && !spinsError && spins.length === 0 && (
                <p>No spins found for this player.</p>
              )}
              {!spinsLoading && !spinsError && spins.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                  }}
                >
                  {spins.map((s) => (
                    <li key={s.id} style={{ marginBottom: 2 }}>
                      <strong>{s.prize_label}</strong> –{" "}
                      {new Date(s.spun_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Coin txs */}
            <div
              style={{
                background: "rgba(15,23,42,0.95)",
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.7)",
                padding: 12,
                fontSize: 13,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: 6,
                  fontSize: 14,
                  fontFamily: "var(--font-cinzel), serif",
                  color: "#e5e7eb",
                }}
              >
                Recent Zeus Coin Transactions
              </h2>
              {txsLoading && <p>Loading transactions…</p>}
              {txsError && (
                <p style={{ color: "#fca5a5" }}>{txsError}</p>
              )}
              {!txsLoading && !txsError && txs.length === 0 && (
                <p>No coin transactions found for this player.</p>
              )}
              {!txsLoading && !txsError && txs.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                  }}
                >
                  {txs.map((t) => (
                    <li key={t.id} style={{ marginBottom: 2 }}>
                      <strong>
                        {t.amount > 0 ? "+" : ""}
                        {t.amount.toLocaleString()} coins
                      </strong>{" "}
                      – {t.type}
                      {t.note ? ` (${t.note})` : ""} on{" "}
                      {new Date(t.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {!selectedUser && (
          <p
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#6b7280",
              textAlign: "center",
            }}
          >
            Tip: Search for a player above to unlock coin tools and history.
          </p>
        )}
      </div>
    </main>
  );
}