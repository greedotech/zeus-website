"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getTierProgress, getTierLabel } from "@/lib/tiers";
import MissionHostPanel from "@/app/components/MissionHostPanel";

type HostProfileRow = {
  is_host: boolean | null;
};

type SimpleUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  zeus_coins: number;
  referred_by: string | null;
  invite_code: string | null;
  favorite_game?: string | null;
  account_tier?: string | null;
  lifetime_coins_spent?: number;
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

const GAME_OPTIONS = [
  "V BLINK", "ULTRA PANDA", "FIRE KIRIN", "ORION STARS", "RIVERSWEEPS",
  "JUWA", "LUCKY STARS", "NOBLE", "FIRE PHOENIX", "KING KONG", "VEGAS X",
  "GAMEVAULT", "GOLDEN DRAGON", "PANDORA GAMES", "MEGA SPINS", "NOVA PLAY",
  "MILKY WAY", "GOLDEN CITY",
];

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No active session. Please log in again.");
  return token;
}

export default function HostConsolePage() {
  const router = useRouter();

  const [checkingHost, setCheckingHost] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const [adjustMode, setAdjustMode] = useState<AdjustMode>("deposit");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositGame, setDepositGame] = useState<string>("");
  const [fbAction, setFbAction] = useState<string>("");
  const [spinOption, setSpinOption] = useState<string>("");
  const [coinsDelta, setCoinsDelta] = useState<number>(0);
  const [savingCoins, setSavingCoins] = useState(false);
  const [coinsMessage, setCoinsMessage] = useState<string | null>(null);

  const [spinHistory, setSpinHistory] = useState<SpinRow[]>([]);
  const [coinHistory, setCoinHistory] = useState<CoinTxRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
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
        setHostError(e?.message || "Unable to verify host permissions. Try again later.");
        setCheckingHost(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  function calcDepositCoins(amountDollars: number): number {
    if (amountDollars < 10) return 0;
    if (amountDollars < 25) return 100;
    if (amountDollars < 50) return 250;
    if (amountDollars < 100) return 600;
    return 1200;
  }

  function calcFacebookCoins(action: string): number {
    switch (action) {
      case "like": return 5;
      case "comment": return 10;
      case "share": return 25;
      case "win": return 50;
      case "referral": return 300;
      default: return 0;
    }
  }

  function calcSpinCoins(option: string): number {
    switch (option) {
      case "spin25": return 25;
      case "spin50": return 50;
      default: return 0;
    }
  }

  useEffect(() => {
    let next = 0;
    if (adjustMode === "deposit") {
      const amt = Number(depositAmount);
      if (!Number.isNaN(amt) && amt > 0) next = calcDepositCoins(amt);
    } else if (adjustMode === "facebook") {
      next = calcFacebookCoins(fbAction);
    } else if (adjustMode === "spin") {
      next = calcSpinCoins(spinOption);
    }
    if (adjustMode !== "manual") setCoinsDelta(next);
  }, [adjustMode, depositAmount, fbAction, spinOption]);

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
      } else if (query.length === 8 && query.match(/^[A-Za-z0-9]+$/)) {
        body.inviteCode = query;
      } else {
        body.username = query;
      }

      const res = await fetch("/api/host/get-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed.");

      const users = (data.users || []) as SimpleUser[];
      if (users.length === 0) {
        setSearchMessage("No player found.");
        setUser(null);
      } else {
        setUser(users[0]);
        setSearchMessage(users.length > 1 ? `Showing first of ${users.length} matches.` : null);
        void loadHistory(users[0].id);
      }
    } catch (e: any) {
      setSearchMessage(e?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }

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
      // silently fail
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleApplyCoins(e: React.FormEvent) {
    e.preventDefault();
    setCoinsMessage(null);

    if (!user) { setCoinsMessage("Select a player first."); return; }

    if (adjustMode === "deposit") {
      const amt = Number(depositAmount);
      if (Number.isNaN(amt) || amt <= 0) { setCoinsMessage("Enter a valid deposit amount."); return; }
      const coins = calcDepositCoins(amt);
      if (coins <= 0) { setCoinsMessage("Deposits under $10 do not award Zeus Coins by rule."); return; }
    } else if (adjustMode === "facebook") {
      if (!fbAction) { setCoinsMessage("Choose a Facebook action first."); return; }
      if (!coinsDelta) { setCoinsMessage("No coins calculated for this action."); return; }
    } else if (adjustMode === "spin") {
      if (!spinOption) { setCoinsMessage("Choose a spin reward option."); return; }
      if (!coinsDelta) { setCoinsMessage("No coins calculated for this spin option."); return; }
    } else if (adjustMode === "manual") {
      if (!coinsDelta || !Number.isFinite(coinsDelta)) { setCoinsMessage("Enter a non-zero coin amount."); return; }
    }

    if (!coinsDelta) { setCoinsMessage("No coins to apply."); return; }

    let note: string | undefined;
    if (adjustMode === "deposit") {
      const amt = Number(depositAmount);
      note = `deposit: $${amt.toFixed(2)}${depositGame ? ` on ${depositGame}` : ""}`;
    } else if (adjustMode === "facebook") {
      const fbLabels: Record<string, string> = {
        like: "Facebook like",
        comment: "Facebook comment",
        share: "Facebook share",
        win: "Facebook win screenshot",
        referral: "Facebook referral (first deposit)",
      };
      note = fbLabels[fbAction] ?? "Facebook action";
    } else if (adjustMode === "spin") {
      note = spinOption === "spin25" ? "Spin win (+25 coins)" : spinOption === "spin50" ? "Spin win (+50 coins)" : "Spin win";
    } else if (adjustMode === "manual") {
      note = "manual host adjustment";
    }

    setSavingCoins(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/host/add-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: user.id,
          amount: coinsDelta,
          note,
          source: adjustMode,
          game: adjustMode === "deposit" ? depositGame || null : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to update coins.");

      setUser((prev) => prev ? { ...prev, zeus_coins: (prev.zeus_coins || 0) + coinsDelta } : prev);
      setCoinsMessage("✅ Coins updated and logged.");
      setCoinsDelta(0);

      if (adjustMode === "deposit") { setDepositAmount(""); setDepositGame(""); }
      else if (adjustMode === "facebook") { setFbAction(""); }
      else if (adjustMode === "spin") { setSpinOption(""); }

      void loadHistory(user.id);
    } catch (e: any) {
      setCoinsMessage(e?.message || "Failed to update coins.");
    } finally {
      setSavingCoins(false);
    }
  }

  if (checkingHost) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", background: "#000", color: "#fff" }}>
        Verifying host access…
      </main>
    );
  }

  if (hostError) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, background: "#000", color: "#fff", textAlign: "center" }}>
        <p>{hostError}</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050510", color: "#f9fafb", padding: "96px 16px 32px", fontFamily: "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>

        {/* HEADER */}
        <header>
          <h1 style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "2rem", marginBottom: 4, color: "#fbbf24" }}>
            Zeus Host Console
          </h1>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
            Search a player, apply Zeus Coins based on deposits or Facebook activity, and review their recent history.
          </p>
          <a href="/host/import" style={{ display: "inline-block", marginTop: 10, padding: "8px 14px", borderRadius: 10, background: "#facc15", color: "#000", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            Upload daily game report →
          </a>
          <a href="/host/payments" style={{ display: "inline-block", marginTop: 10, marginLeft: 10, padding: "8px 14px", borderRadius: 10, border: "1px solid #facc15", color: "#fde68a", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            Payments &amp; reconciliation →
          </a>
        </header>

        {/* 1. SEARCH */}
        <section style={{ borderRadius: 16, background: "radial-gradient(circle at top, rgba(250,204,21,0.15), transparent 60%)", border: "1px solid rgba(250,204,21,0.35)", padding: "16px 18px", display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontFamily: "var(--font-cinzel), serif" }}>1. Find Player</h2>
          <form onSubmit={handleSearch} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search by username, email, or invite code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 220px", minWidth: 0, padding: "8px 10px", borderRadius: 10, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb" }}
            />
            <button type="submit" disabled={searching} style={{ padding: "9px 14px", borderRadius: 999, border: "none", background: "linear-gradient(90deg, #facc15, #f97316, #ea580c)", color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", minWidth: 120 }}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchMessage && <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb" }}>{searchMessage}</p>}
        </section>

        {/* 2. PLAYER + 3. COINS */}
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.1fr)", gap: 16 }}>

          {/* Player card */}
          <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.6)", padding: "14px 16px", minHeight: 140 }}>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontFamily: "var(--font-cinzel), serif" }}>2. Player Overview</h2>
            {!user ? (
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Search for a player to view their details.</p>
            ) : (() => {
              const coins = user.zeus_coins ?? 0;
              const tierProgress = getTierProgress(coins);
              const currentLabel = getTierLabel(tierProgress.current);
              return (
                <div style={{ fontSize: 14, display: "grid", gap: 4 }}>
                  <div><strong>Name:</strong> {user.first_name || user.last_name ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "—"}</div>
                  <div><strong>Username:</strong> {user.username || "—"}</div>
                  <div><strong>Email:</strong> {user.email || "—"}</div>
                  <div><strong>Zeus Coins:</strong> {coins.toLocaleString()}</div>
                  <div><strong>Tier:</strong> {tierProgress.current} — <span style={{ color: "#facc15" }}>{currentLabel}</span></div>
                  {tierProgress.next && tierProgress.neededForNext !== null && (
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                      {tierProgress.neededForNext! > 0 ? (
                        <>{tierProgress.neededForNext!.toLocaleString()} more coins to reach <strong>{tierProgress.next}</strong> ({Math.round(tierProgress.percentToNext)}% of this tier).</>
                      ) : (
                        <>Eligible for next tier upgrade.</>
                      )}
                    </div>
                  )}
                  <div><strong>Invite Code:</strong> {user.invite_code || "—"}</div>
                  <div><strong>Favorite Game:</strong> {user.favorite_game || "—"}</div>
                  <div><strong>Account Tier:</strong> {user.account_tier || "—"}</div>
                  <div><strong>Lifetime Coins Spent:</strong> {user.lifetime_coins_spent?.toLocaleString() ?? "—"}</div>
                  <div><strong>Referred By:</strong> {user.referred_by || "—"}</div>
                </div>
              );
            })()}
          </div>

          {/* Coins editor */}
          <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.6)", padding: "14px 16px", minHeight: 140 }}>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontFamily: "var(--font-cinzel), serif" }}>3. Adjust Zeus Coins</h2>
            {!user ? (
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Select a player first.</p>
            ) : (
              <form onSubmit={handleApplyCoins} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
                  {(["deposit", "facebook", "spin", "manual"] as AdjustMode[]).map((mode) => (
                    <button key={mode} type="button" onClick={() => setAdjustMode(mode)} style={{ padding: "6px 10px", borderRadius: 999, border: adjustMode === mode ? "1px solid #facc15" : "1px solid #4b5563", background: adjustMode === mode ? "rgba(250,204,21,0.15)" : "transparent", color: "#e5e7eb", cursor: "pointer", textTransform: "capitalize" }}>
                      {mode === "spin" ? "Spin Win" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                {adjustMode === "deposit" && (
                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <label style={{ display: "grid", gap: 2 }}>
                      Deposit amount ($)
                      <input type="number" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 40" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb" }} />
                    </label>
                    <label style={{ display: "grid", gap: 2 }}>
                      Game (optional)
                      <select value={depositGame} onChange={(e) => setDepositGame(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb" }}>
                        <option value="">Select game…</option>
                        {GAME_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                      Coins rule: $10–24.99 → 100 • $25–49.99 → 250 • $50–99.99 → 600 • $100+ → 1,200.
                    </p>
                  </div>
                )}

                {adjustMode === "facebook" && (
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <label style={{ display: "grid", gap: 2 }}>
                      Facebook action
                      <select value={fbAction} onChange={(e) => setFbAction(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb" }}>
                        <option value="">Select…</option>
                        <option value="like">Like a post (+5)</option>
                        <option value="comment">Comment on a post (+10)</option>
                        <option value="share">Share a post (+25)</option>
                        <option value="win">Post win screenshot in group (+50)</option>
                        <option value="referral">Referral – friend makes first deposit (+300)</option>
                      </select>
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                      Verify via screenshots or activity before awarding coins.
                    </p>
                  </div>
                )}

                {adjustMode === "spin" && (
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <label style={{ display: "grid", gap: 2 }}>
                      Spin win
                      <select value={spinOption} onChange={(e) => setSpinOption(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb" }}>
                        <option value="">Select…</option>
                        <option value="spin25">+25 Zeus Coins</option>
                        <option value="spin50">+50 Zeus Coins</option>
                      </select>
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                      Use this when a spin result grants extra Zeus Coins.
                    </p>
                  </div>
                )}

                {adjustMode === "manual" && (
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <label style={{ display: "grid", gap: 2 }}>
                      Manual coin amount
                      <input type="number" value={coinsDelta} onChange={(e) => setCoinsDelta(Number(e.target.value) || 0)} placeholder="e.g. 500 or -500" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #4b5563", background: "#020617", color: "#e5e7eb" }} />
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Positive adds coins, negative removes.</p>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 13, color: "#e5e7eb" }}>
                    Coins to apply:{" "}
                    <strong style={{ color: coinsDelta > 0 ? "#22c55e" : coinsDelta < 0 ? "#f97316" : "#e5e7eb" }}>
                      {coinsDelta > 0 ? `+${coinsDelta}` : coinsDelta}
                    </strong>
                  </div>
                  <button type="submit" disabled={savingCoins} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: "linear-gradient(90deg, #22c55e, #16a34a, #15803d)", color: "#022c22", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", minWidth: 120 }}>
                    {savingCoins ? "Saving…" : "Apply"}
                  </button>
                </div>

                {coinsMessage && <p style={{ margin: 0, marginTop: 4, fontSize: 13, color: "#e5e7eb" }}>{coinsMessage}</p>}
              </form>
            )}
          </div>
        </section>

        {/* 4. HISTORY */}
        <section style={{ borderRadius: 16, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.6)", padding: "14px 16px", display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontFamily: "var(--font-cinzel), serif" }}>4. Recent Activity</h2>
          {!user ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Search for a player to view their activity.</p>
          ) : loadingHistory ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Loading history…</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#fbbf24" }}>Coin Transactions</h3>
                {coinHistory.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>No transactions found.</p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                    {coinHistory.map((tx) => (
                      <li key={tx.id} style={{ fontSize: 12, color: "#e5e7eb", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 4 }}>
                        <span style={{ color: tx.amount > 0 ? "#22c55e" : "#f97316", fontWeight: 700 }}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </span>{" "}
                        — {tx.note || tx.type} —{" "}
                        <span style={{ color: "#6b7280" }}>{new Date(tx.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#fbbf24" }}>Spin History</h3>
                {spinHistory.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>No spins found.</p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                    {spinHistory.map((s) => (
                      <li key={s.id} style={{ fontSize: 12, color: "#e5e7eb", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 4 }}>
                        <span style={{ color: "#fbbf24", fontWeight: 700 }}>{s.label}</span>{" "}
                        (+{s.reward}) —{" "}
                        <span style={{ color: "#6b7280" }}>{new Date(s.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 5. DAILY MISSIONS */}
        <section style={{ borderRadius: 16, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.6)", padding: "14px 16px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontFamily: "var(--font-cinzel), serif" }}>5. Daily Missions</h2>
          <MissionHostPanel />
        </section>

      </div>
    </main>
  );
}