"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type HostUser = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  zeus_coins: number | null;
};

type SpinRow = {
  id: string;
  spun_at: string;
  prize_label: string;
  prize_type: string;
  prize_value: number;
};

export default function HostPage() {
  const router = useRouter();

  // ---- route protection state ----
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  // ---- host console state ----
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [user, setUser] = useState<HostUser | null>(null);

  const [spinHistory, setSpinHistory] = useState<SpinRow[]>([]);
  const [spinLoading, setSpinLoading] = useState(false);

  const [addAmount, setAddAmount] = useState("0");
  const [addNote, setAddNote] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ========= 1. ROUTE PROTECTION =========
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        if (!cancelled) {
          // not logged in -> go to login
          router.replace("/login?next=/host");
        }
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("is_host")
        .eq("id", data.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileErr || !profile?.is_host) {
        setAccessDenied(
          "You do not have permission to access the Zeus Lounge Host Console."
        );
      }

      setCheckingAccess(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingAccess) {
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
        Checking access…
      </main>
    );
  }

  if (accessDenied) {
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
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Access denied</h1>
          <p style={{ marginBottom: 12 }}>{accessDenied}</p>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,215,0,0.4)",
              background: "transparent",
              color: "#facc15",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Return to lobby
          </button>
        </div>
      </main>
    );
  }

  // ========= 2. HOST CONSOLE HELPERS =========

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;

    setSearchError(null);
    setMessage(null);
    setSearchLoading(true);
    setUser(null);
    setSpinHistory([]);

    try {
      const res = await fetch(
        `/api/host/get-user?q=${encodeURIComponent(search.trim())}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Unable to find player.");
      }
      const data = await res.json();
      setUser(data.user as HostUser);
      // load spins straight away
      await loadSpinHistory(data.user.id);
    } catch (err: any) {
      setSearchError(err.message || "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadSpinHistory(userId: string) {
    setSpinLoading(true);
    try {
      const res = await fetch(
        `/api/host/spin-history?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Unable to load spin history.");
      }
      const data = await res.json();
      setSpinHistory(data.spins as SpinRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setSpinLoading(false);
    }
  }

  async function handleAddCoins(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const amt = Number(addAmount);
    if (!Number.isFinite(amt) || amt === 0) {
      setMessage("Enter a non-zero amount.");
      return;
    }

    setAddLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/host/add-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          note: addNote || "manual host adjustment",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to add coins.");
      }

      // update local balance + show message
      setUser((prev) =>
        prev
          ? {
              ...prev,
              zeus_coins: (prev.zeus_coins ?? 0) + amt,
            }
          : prev
      );
      setMessage(`Adjusted coins by ${amt.toLocaleString()} successfully.`);
      setAddAmount("0");
      setAddNote("");
    } catch (err: any) {
      setMessage(err.message || "Unable to add coins.");
    } finally {
      setAddLoading(false);
    }
  }

  // ========= 3. MAIN HOST UI =========

  const coins = user?.zeus_coins ?? 0;
  const fullName =
    user && (user.first_name || user.last_name)
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
      : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "80px 16px 32px",
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
        {/* HEADER */}
        <header>
          <h1
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "2.4rem",
              margin: 0,
              background: "linear-gradient(to right, #FFD700, #FFF8DC)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 15px rgba(255,255,255,0.45)",
            }}
          >
            Host Console
          </h1>
          <p style={{ marginTop: 8, color: "#d1d5db" }}>
            Search players, view Zeus Coins, and log adjustments or spin
            history.
          </p>
        </header>

        {/* SEARCH CARD */}
        <section
          style={{
            background: "rgba(0,0,0,0.7)",
            borderRadius: 16,
            border: "1px solid #eab308",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            padding: 16,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.4rem",
              margin: 0,
              marginBottom: 8,
              color: "#facc15",
            }}
          >
            Find Player
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#e5e7eb" }}>
            Search by email, username, or player ID.
          </p>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="email@domain.com or username"
              style={{
                flex: 1,
                minWidth: 220,
                padding: "9px 11px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#111827",
                color: "#fff",
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              disabled={searchLoading}
              style={{
                padding: "9px 14px",
                borderRadius: 999,
                border: "none",
                background: "#facc15",
                color: "#000",
                fontWeight: 700,
                minWidth: 120,
                cursor: searchLoading ? "default" : "pointer",
              }}
            >
              {searchLoading ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && (
            <p style={{ marginTop: 8, fontSize: 13, color: "#fca5a5" }}>
              {searchError}
            </p>
          )}
        </section>

        {/* PLAYER DETAILS + COIN ADJUST */}
        {user && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.1fr)",
              gap: 18,
            }}
          >
            {/* Player card */}
            <div
              style={{
                background: "rgba(15,15,25,0.9)",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.5)",
                padding: 16,
                display: "grid",
                gap: 6,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "1.3rem",
                  margin: 0,
                  marginBottom: 6,
                  color: "#EED27A",
                }}
              >
                Player Overview
              </h2>
              <Row label="Name" value={fullName || "—"} />
              <Row label="Username" value={user.username || "—"} />
              <Row label="Email" value={user.email || "—"} />
              <Row
                label="Zeus Coins"
                value={(coins ?? 0).toLocaleString()}
              />
            </div>

            {/* Adjust coins form */}
            <div
              style={{
                background: "rgba(15,15,25,0.9)",
                borderRadius: 14,
                border: "1px solid rgba(234,179,8,0.6)",
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "1.3rem",
                  margin: 0,
                  marginBottom: 4,
                  color: "#facc15",
                }}
              >
                Adjust Coins
              </h2>
              <p
                style={{
                  margin: 0,
                  marginBottom: 4,
                  fontSize: 13,
                  color: "#e5e7eb",
                }}
              >
                Positive values add coins, negative values remove coins. All
                changes are logged.
              </p>
              <form
                onSubmit={handleAddCoins}
                style={{
                  display: "grid",
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 13, color: "#d1d5db" }}>
                  Amount (e.g. 500 or -250)
                </label>
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #374151",
                    background: "#111827",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
                <label style={{ fontSize: 13, color: "#d1d5db" }}>
                  Note (optional, shown in transaction log)
                </label>
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="e.g. manual adjustment after promo"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #374151",
                    background: "#111827",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    marginTop: 4,
                    padding: "9px 12px",
                    borderRadius: 999,
                    border: "none",
                    background: "#f97316",
                    color: "#000",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    cursor: addLoading ? "default" : "pointer",
                  }}
                >
                  {addLoading ? "Saving…" : "Apply Change"}
                </button>
              </form>
              {message && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: message.includes("Unable") ? "#fca5a5" : "#bbf7d0",
                  }}
                >
                  {message}
                </p>
              )}
            </div>
          </section>
        )}

        {/* SPIN HISTORY */}
        {user && (
          <section
            style={{
              background: "rgba(15,15,25,0.9)",
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.5)",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "1.2rem",
                  margin: 0,
                  color: "#EED27A",
                }}
              >
                Daily Spin History
              </h2>
              <button
                onClick={() => loadSpinHistory(user.id)}
                disabled={spinLoading}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.8)",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: 12,
                  cursor: spinLoading ? "default" : "pointer",
                }}
              >
                {spinLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {spinHistory.length === 0 && !spinLoading && (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                No spins logged for this player yet.
              </p>
            )}

            {spinHistory.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                {spinHistory.map((s) => {
                  const d = new Date(s.spun_at);
                  return (
                    <li
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        borderBottom:
                          "1px dashed rgba(55,65,81,0.7)",
                        paddingBottom: 3,
                      }}
                    >
                      <span style={{ color: "#e5e7eb" }}>
                        {s.prize_label}
                      </span>
                      <span style={{ color: "#9ca3af" }}>
                        {d.toLocaleDateString()}{" "}
                        {d.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* mobile stack tweak for 2-column section */}
      <style jsx>{`
        @media (max-width: 820px) {
          section:nth-of-type(3) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 6,
        fontSize: 14,
      }}
    >
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}