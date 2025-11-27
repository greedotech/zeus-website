"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTierProgress, getTierLabel } from "@/lib/tiers";

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
  favorite_game?: string | null;
  // optional, in case you later add it in DB
  tier?: string | null;
};

type SpinRow = {
  id: string;
  created_at: string;
  reward: number;
  label: string;
  note: string | null;
};

type CoinTxRow = {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  note: string | null;
};

type AdjustMode = "deposit" | "facebook" | "spin" | "manual";

// Same game labels as your games page, for the deposit “Game” dropdown
const GAME_OPTIONS = [
  "V BLINK",
  "ULTRA PANDA",
  "FIRE KIRIN",
  "ORION STARS",
  "RIVERSWEEPS",
  "JUWA",
  "LUCKY STARS",
  "NOBLE",
  "FIRE PHOENIX",
  "KING KONG",
  "VEGAS X",
  "GAMEVAULT",
  "GOLDEN DRAGON",
  "PANDORA GAMES",
  "MEGA SPINS",
  "NOVA PLAY",
  "MILKY WAY",
  "GOLDEN CITY",
];

// 🔑 Helper: get current user's access token for Authorization header
async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("No active session. Please log in again.");
  }
  return token;
}

export default function HostConsolePage() {
  const router = useRouter();

  // --- Host gate state ---
  const [checkingHost, setCheckingHost] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);

  // --- Player search / selection ---
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // --- Coins adjust ---
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("deposit");

  // deposit-specific
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositGame, setDepositGame] = useState<string>("");

  // facebook-specific
  const [fbAction, setFbAction] = useState<string>("");

  // spin-specific
  const [spinOption, setSpinOption] = useState<string>("");

  // manual / general coins delta
  const [coinsDelta, setCoinsDelta] = useState<number>(0);
  const [savingCoins, setSavingCoins] = useState(false);
  const [coinsMessage, setCoinsMessage] = useState<string | null>(null);

  // --- History ---
  const [spinHistory, setSpinHistory] = useState<SpinRow[]>([]);
  const [coinHistory, setCoinHistory] = useState<CoinTxRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ----------------------------
  // 1) HOST-ONLY ROUTE GUARD
  // ----------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();

        if (authErr) throw authErr;

        if (!authData.user) {
          if (!mounted) return;
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("is_host")
          .eq("id", authData.user.id)
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
  // 2) HELPER – CALC COINS FROM RULES
  // ----------------------------
  function calcDepositCoins(amountDollars: number): number {
    if (amountDollars < 10) return 0;
    if (amountDollars < 25) return 600;
    if (amountDollars < 50) return 1500;
    if (amountDollars < 100) return 3500;
    return 8000; // $100+
  }

  function calcFacebookCoins(action: string): number {
    switch (action) {
      case "like":
        return 10;
      case "comment":
        return 20;
      case "share":
        return 40;
      case "win":
        return 80;
      case "referral":
        return 500;
      default:
        return 0;
    }
  }

  function calcSpinCoins(option: string): number {
    switch (option) {
      case "spin25":
        return 25;
      case "spin50":
        return 50;
      default:
        return 0;
    }
  }

  // Whenever deposit / fb / spin inputs change, recompute coinsDelta
  useEffect(() => {
    let next = 0;

    if (adjustMode === "deposit") {
      const amt = Number(depositAmount);
      if (!Number.isNaN(amt) && amt > 0) {
        next = calcDepositCoins(amt);
      }
    } else if (adjustMode === "facebook") {
      next = calcFacebookCoins(fbAction);
    } else if (adjustMode === "spin") {
      next = calcSpinCoins(spinOption);
    }

    if (adjustMode !== "manual") {
      setCoinsDelta(next);
    }
  }, [adjustMode, depositAmount, fbAction, spinOption]);

  // ----------------------------
  // 3) SEARCH PLAYER (uses Authorization header)
  // ----------------------------
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchMessage(null);
    setUser(null);
    setSpinHistory([]);
    setCoinHistory([]);
    setCoinsMessage(null);

    const query = search.trim();
    if (!query) {
      setSearchMessage("Enter a username, email, or invite code.");
      return;
    }

    setSearching(true);
    try {
      const token = await getAccessToken();

      const body: any = {};
      if (query.includes("@")) {
        body.email = query;
      } else if (query.length >= 6 && query.match(/^[A-Za-z0-9]+$/)) {
        body.username = query;
      } else {
        body.username = query;
      }

      const res = await fetch("/api/host/get-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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
  // 4) LOAD HISTORY FOR USER (also uses Authorization)
  // ----------------------------
  async function loadHistory(userId: string) {
    setLoadingHistory(true);
    try {
      const token = await getAccessToken();

      const [spinsRes, coinsRes] = await Promise.all([
        fetch(`/api/host/spin-history?user_id=${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/host/coin-history?user_id=${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const spinJson = spinsRes.ok ? await spinsRes.json() : { rows: [] };
      const coinJson = coinsRes.ok ? await coinsRes.json() : { rows: [] };

      setSpinHistory(spinJson.rows || []);
      setCoinHistory(coinJson.rows || []);
    } catch {
      // optional: set an error
    } finally {
      setLoadingHistory(false);
    }
  }

  // ----------------------------
  // 5) APPLY COIN CHANGE (also uses Authorization)
  // ----------------------------
  async function handleApplyCoins(e: React.FormEvent) {
    e.preventDefault();
    setCoinsMessage(null);
    if (!user) {
      setCoinsMessage("Select a player first.");
      return;
    }

    if (adjustMode === "deposit") {
      const amt = Number(depositAmount);
      if (Number.isNaN(amt) || amt <= 0) {
        setCoinsMessage("Enter a valid deposit amount.");
        return;
      }
      const coins = calcDepositCoins(amt);
      if (coins <= 0) {
        setCoinsMessage(
          "Deposits under $10 do not award Zeus Coins by rule."
        );
        return;
      }
    } else if (adjustMode === "facebook") {
      if (!fbAction) {
        setCoinsMessage("Choose a Facebook action first.");
        return;
      }
      if (!coinsDelta) {
        setCoinsMessage("No coins calculated for this action.");
        return;
      }
    } else if (adjustMode === "spin") {
      if (!spinOption) {
        setCoinsMessage("Choose a spin reward option.");
        return;
      }
      if (!coinsDelta) {
        setCoinsMessage("No coins calculated for this spin option.");
        return;
      }
    } else if (adjustMode === "manual") {
      if (!coinsDelta || !Number.isFinite(coinsDelta)) {
        setCoinsMessage("Enter a non-zero coin amount.");
        return;
      }
    }

    if (!coinsDelta) {
      setCoinsMessage("No coins to apply.");
      return;
    }

    // Build a helpful note for the backend log
    let note: string | undefined;
    if (adjustMode === "deposit") {
      const amt = Number(depositAmount);
      note = `deposit: $${amt.toFixed(2)}${
        depositGame ? ` on ${depositGame}` : ""
      }`;
    } else if (adjustMode === "facebook") {
      const label =
        fbAction === "like"
          ? "Facebook like"
          : fbAction === "comment"
          ? "Facebook comment"
          : fbAction === "share"
          ? "Facebook share"
          : fbAction === "win"
          ? "Facebook win screenshot"
          : fbAction === "referral"
          ? "Facebook referral (first deposit)"
          : "Facebook action";
      note = label;
    } else if (adjustMode === "spin") {
      const label =
        spinOption === "spin25"
          ? "Spin win (+25 coins)"
          : spinOption === "spin50"
          ? "Spin win (+50 coins)"
          : "Spin win";
      note = label;
    } else if (adjustMode === "manual") {
      note = "manual host adjustment";
    }

    setSavingCoins(true);
    try {
      const token = await getAccessToken();

      const res = await fetch("/api/host/add-coins", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    user_id: user.id,
    amount: coinsDelta,
    note,
    source: adjustMode,                                
    game:
      adjustMode === "deposit"
        ? depositGame || null
        : null,
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

      if (adjustMode === "deposit") {
        setDepositAmount("");
        setDepositGame("");
      } else if (adjustMode === "facebook") {
        setFbAction("");
      } else if (adjustMode === "spin") {
        setSpinOption("");
      }

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
            Search a player, apply Zeus Coins based on deposits or Facebook
            activity, and review their recent history.
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
              (() => {
                const coins = user.zeus_coins ?? 0;
                const tierProgress = getTierProgress(coins);
                const currentLabel = getTierLabel(tierProgress.current);

                return (
                  <div style={{ fontSize: 14, display: "grid", gap: 4 }}>
                    <div>
                      <strong>Name:</strong>{" "}
                      {user.first_name || user.last_name
                        ? `${user.first_name ?? ""} ${
                            user.last_name ?? ""
                          }`.trim()
                        : "—"}
                    </div>
                    <div>
                      <strong>Username:</strong> {user.username || "—"}
                    </div>
                    <div>
                      <strong>Zeus Coins:</strong>{" "}
                      {coins.toLocaleString()}
                    </div>
                    <div>
                      <strong>Tier:</strong> {tierProgress.current} —{" "}
                      <span style={{ color: "#facc15" }}>{currentLabel}</span>
                    </div>
                    {tierProgress.next &&
                      tierProgress.neededForNext !== null && (
                        <div
                          style={{
                            fontSize: 13,
                            color: "#9ca3af",
                          }}
                        >
                          {tierProgress.neededForNext! > 0 ? (
                            <>
                              {tierProgress.neededForNext!.toLocaleString()}{" "}
                              more coins to reach{" "}
                              <strong>{tierProgress.next}</strong> (
                              {tierProgress.percentToNext}% of this tier).
                            </>
                          ) : (
                            <>Eligible for next tier upgrade.</>
                          )}
                        </div>
                      )}
                    <div>
                      <strong>Invite Code:</strong>{" "}
                      <div>
                      <strong>Favorite Game:</strong> {user.favorite_game || "—"}
                      </div>
                      {user.invite_code || "—"}
                    </div>
                  </div>
                );
              })()
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
                }}
              >
                {/* Mode selector */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAdjustMode("deposit")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border:
                        adjustMode === "deposit"
                          ? "1px solid #facc15"
                          : "1px solid #4b5563",
                      background:
                        adjustMode === "deposit"
                          ? "rgba(250,204,21,0.15)"
                          : "transparent",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode("facebook")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border:
                        adjustMode === "facebook"
                          ? "1px solid #facc15"
                          : "1px solid #4b5563",
                      background:
                        adjustMode === "facebook"
                          ? "rgba(250,204,21,0.15)"
                          : "transparent",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    Facebook
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode("spin")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border:
                        adjustMode === "spin"
                          ? "1px solid #facc15"
                          : "1px solid #4b5563",
                      background:
                        adjustMode === "spin"
                          ? "rgba(250,204,21,0.15)"
                          : "transparent",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    Spin win
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustMode("manual")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border:
                        adjustMode === "manual"
                          ? "1px solid #facc15"
                          : "1px solid #4b5563",
                      background:
                        adjustMode === "manual"
                          ? "rgba(250,204,21,0.15)"
                          : "transparent",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    Manual
                  </button>
                </div>

                {/* Mode-specific controls */}
                {adjustMode === "deposit" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    <label>
                      Deposit amount ($)
                      <input
                        type="number"
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="e.g. 40"
                        style={{
                          marginTop: 2,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "#e5e7eb",
                        }}
                      />
                    </label>

                    <label>
                      Game (optional)
                      <select
                        value={depositGame}
                        onChange={(e) => setDepositGame(e.target.value)}
                        style={{
                          marginTop: 2,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "#e5e7eb",
                        }}
                      >
                        <option value="">Select game…</option>
                        {GAME_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      Coins rule: $10–24.99 → 600 • $25–49.99 → 1,500 •
                      $50–99.99 → 3,500 • $100+ → 8,000.
                    </p>
                  </div>
                )}

                {adjustMode === "facebook" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <label>
                      Facebook action
                      <select
                        value={fbAction}
                        onChange={(e) => setFbAction(e.target.value)}
                        style={{
                          marginTop: 2,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "#e5e7eb",
                        }}
                      >
                        <option value="">Select…</option>
                        <option value="like">Like a post (+10)</option>
                        <option value="comment">Comment on a post (+20)</option>
                        <option value="share">Share a post (+40)</option>
                        <option value="win">
                          Post win screenshot in group (+80)
                        </option>
                        <option value="referral">
                          Referral – friend makes first deposit (+500)
                        </option>
                      </select>
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      Hosts should verify via screenshots or activity before
                      awarding coins.
                    </p>
                  </div>
                )}

                {adjustMode === "spin" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <label>
                      Spin win
                      <select
                        value={spinOption}
                        onChange={(e) => setSpinOption(e.target.value)}
                        style={{
                          marginTop: 2,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "#e5e7eb",
                        }}
                      >
                        <option value="">Select…</option>
                        <option value="spin25">+25 Zeus Coins</option>
                        <option value="spin50">+50 Zeus Coins</option>
                      </select>
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      Use this when a spin result grants extra Zeus Coins.
                    </p>
                  </div>
                )}

                {adjustMode === "manual" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <label>
                      Manual coin amount
                      <input
                        type="number"
                        value={coinsDelta}
                        onChange={(e) =>
                          setCoinsDelta(Number(e.target.value) || 0)
                        }
                        placeholder="e.g. 500 or -500"
                        style={{
                          marginTop: 2,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #4b5563",
                          background: "#020617",
                          color: "#e5e7eb",
                        }}
                      />
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#9ca3af",
                      }}
                    >
                      Use for corrections or special cases. Positive adds coins,
                      negative removes.
                    </p>
                  </div>
                )}

                {/* Summary + Apply button */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "#e5e7eb",
                    }}
                  >
                    Coins to apply:{" "}
                    <strong
                      style={{
                        color:
                          coinsDelta > 0
                            ? "#22c55e"
                            : coinsDelta < 0
                            ? "#f97316"
                            : "#e5e7eb",
                      }}
                    >
                      {coinsDelta > 0 ? `+${coinsDelta}` : coinsDelta}
                    </strong>
                  </div>
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
                </div>

                {coinsMessage && (
                  <p
                    style={{
                      margin: 0,
                      marginTop: 4,
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
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#9ca3af",
                    }}
                  >
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
                        {row.reward} pts{" "}
                        {row.label ? `(${row.label})` : ""}
                        {row.note ? ` – ${row.note}` : ""}
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
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#9ca3af",
                    }}
                  >
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