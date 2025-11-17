"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  dob: string | null;
  zeus_coins: number | null;
};

type Segment = {
  label: string;
  value: number;
  kind: "PERCENT" | "COINS";
};

type SpinRow = {
  id: string;
  created_at: string;
  result_label: string;
  result_kind: "PERCENT" | "COINS";
  result_value: number;
};

// 🎯 wheel segments
const SEGMENTS: Segment[] = [
  { label: "5% Match Boost", value: 5, kind: "PERCENT" },
  { label: "10% Match Boost", value: 10, kind: "PERCENT" },
  { label: "15% Match Boost", value: 15, kind: "PERCENT" },
  { label: "20% Match Boost", value: 20, kind: "PERCENT" },
  { label: "+25 Zeus Coins", value: 25, kind: "COINS" },
  { label: "+50 Zeus Coins", value: 50, kind: "COINS" },
];

const LOCAL_KEY_LAST_SPIN = "zeus_last_daily_spin";
const LOCAL_KEY_LAST_RESULT = "zeus_last_daily_result";

export default function BonusPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // live coins state (so we can update after spin)
  const [coins, setCoins] = useState<number>(0);

  // wheel state
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinAvailable, setSpinAvailable] = useState(true);
  const [resultIndex, setResultIndex] = useState<number | null>(null);

  // spin history
  const [history, setHistory] = useState<SpinRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ---------- load profile ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          setProfileError("You must be logged in to access the Bonus Center.");
          setLoadingProfile(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username, dob, zeus_coins")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        if (data) {
          setProfile(data);
          setCoins(data.zeus_coins ?? 0);
        } else {
          const fallback: ProfileRow = {
            id: user.id,
            first_name: (user.user_metadata as any)?.first_name ?? null,
            last_name: (user.user_metadata as any)?.last_name ?? null,
            username: (user.user_metadata as any)?.username ?? null,
            dob: (user.user_metadata as any)?.dob ?? null,
            zeus_coins: 0,
          };
          setProfile(fallback);
          setCoins(0);
        }
      } catch (e: any) {
        if (!mounted) return;
        setProfileError(e.message || "Unable to load profile.");
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------- load daily availability from localStorage ----------
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const storedDate =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LOCAL_KEY_LAST_SPIN)
        : null;
    const storedResult =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LOCAL_KEY_LAST_RESULT)
        : null;

    if (storedDate === todayStr) {
      setSpinAvailable(false);
      if (storedResult) {
        const idx = Number(storedResult);
        if (!Number.isNaN(idx)) setResultIndex(idx);
      }
    } else {
      setSpinAvailable(true);
      setResultIndex(null);
    }
  }, []);

  // ---------- load recent spin history (last 10 from bonus_spins) ----------
  useEffect(() => {
    const loadHistory = async () => {
      if (!profile?.id) return;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { data, error } = await supabase
          .from("bonus_spins")
          .select("id, created_at, result_label, result_kind, result_value")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setHistory(data || []);
      } catch (e: any) {
        setHistoryError(e.message || "Unable to load spin history.");
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [profile?.id]);

  const refreshHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("bonus_spins")
        .select("id, created_at, result_label, result_kind, result_value")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error("Failed to refresh history", e);
    }
  };

  // ---------- spin handler (calls /api/bonus/spin) ----------
  const handleSpin = () => {
    if (spinning || !spinAvailable) return;

    setSpinning(true);

    // random segment
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    setResultIndex(idx);

    // each slice has same angle
    const slice = 360 / SEGMENTS.length;
    const targetAngle = 360 * 5 + (slice * idx + slice / 2); // 5 spins + center of slice
    setSpinAngle(targetAngle);

    setTimeout(async () => {
      const todayStr = new Date().toISOString().slice(0, 10);

      // lock on this device
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_KEY_LAST_SPIN, todayStr);
        window.localStorage.setItem(LOCAL_KEY_LAST_RESULT, String(idx));
      }

      // tell backend & update coins/history
      try {
        const seg = SEGMENTS[idx];

        const res = await fetch("/api/bonus/spin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: seg.label,
            value: seg.value,
            kind: seg.kind,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          console.error("Spin log failed:", json);
        } else {
          if (typeof json.newBalance === "number") {
            setCoins(json.newBalance);
          }
          if (profile?.id) {
            await refreshHistory(profile.id);
          }
        }
      } catch (e) {
        console.error("Error logging spin:", e);
      }

      setSpinning(false);
      setSpinAvailable(false);
    }, 2800);
  };

  // ---------- birthday logic ----------
  const dobStr = profile?.dob || null;
  let birthdayMessage: string | null = null;
  let isBirthday = false;

  if (dobStr) {
    const dob = new Date(dobStr);
    const today = new Date();
    const thisYear = today.getFullYear();
    const nextBirthday = new Date(thisYear, dob.getMonth(), dob.getDate());

    if (
      nextBirthday.getDate() === today.getDate() &&
      nextBirthday.getMonth() === today.getMonth()
    ) {
      isBirthday = true;
      birthdayMessage =
        "Happy Birthday! Ask a host about your Zeus birthday bonus 🎉";
    } else {
      if (nextBirthday < today) {
        nextBirthday.setFullYear(thisYear + 1);
      }
      const diffMs = nextBirthday.getTime() - today.getTime();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      birthdayMessage = `Your next birthday bonus unlocks in ${days} day${
        days === 1 ? "" : "s"
      }.`;
    }
  }

  const selected = resultIndex !== null ? SEGMENTS[resultIndex] : null;

  // ---------- loading / error states ----------
  if (loadingProfile) {
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
        Loading bonus center…
      </main>
    );
  }

  if (profileError) {
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
        <p>{profileError}</p>
      </main>
    );
  }

  // ---------- main UI ----------
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
              fontSize: "2.4rem",
              margin: 0,
              background: "linear-gradient(to right, #FFD700, #FFF8DC)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 15px rgba(255,255,255,0.45)",
            }}
          >
            Zeus Bonus Center
          </h1>
          <p style={{ marginTop: 8, color: "#d1d5db" }}>
            Spin your daily wheel, check your birthday bonus, and keep an eye on
            your Zeus Coins.
          </p>
        </header>

        {/* Coins + daily info */}
        <section
          style={{
            background: "rgba(0,0,0,0.7)",
            borderRadius: 16,
            border: "1px solid #eab308",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
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
                fontSize: 12,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Zeus Coins
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fef9c3" }}>
              {coins.toLocaleString()}
            </div>
          </div>
          <div style={{ maxWidth: 360, fontSize: 14, color: "#e5e7eb" }}>
            Daily spins can award <strong>match boosts</strong> or extra{" "}
            <strong>Zeus Coins</strong>. Show your result to a host before your
            next deposit to claim.
          </div>
        </section>

        {/* Wheel + birthday/claim info (responsive grid) */}
        <section
          className="bonus-grid-section"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.2fr)",
            gap: 20,
          }}
        >
          {/* Wheel block */}
          <div
            style={{
              background: "rgba(15,15,25,0.85)",
              borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.4)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.7)",
              padding: 16,
              display: "grid",
              gap: 12,
              placeItems: "center",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-cinzel), serif",
                fontSize: "1.4rem",
                margin: 0,
                color: "#facc15",
              }}
            >
              Daily Lightning Spin ⚡
            </h2>

            {/* Wheel + pointer */}
            <div
              style={{
                position: "relative",
                width: "min(260px, 70vw)",
                height: "min(260px, 70vw)",
              }}
            >
              {/* Pointer */}
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "10px solid transparent",
                  borderRight: "10px solid transparent",
                  borderBottom: "20px solid #facc15",
                  filter: "drop-shadow(0 0 6px rgba(250,204,21,0.75))",
                  zIndex: 3,
                }}
              />

              {/* Wheel disc */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "4px solid #facc15",
                  background:
                    "conic-gradient(from 0deg, #111827, #1f2937, #111827, #1f2937, #111827)",
                  boxShadow:
                    "0 0 30px rgba(0,0,0,0.9), 0 0 16px rgba(250,204,21,0.4)",
                  transform: `rotate(${spinAngle}deg)`,
                  transition: spinning
                    ? "transform 2.8s cubic-bezier(0.19, 1, 0.22, 1)"
                    : "none",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {/* Inner glow + text */}
                <div
                  style={{
                    width: "72%",
                    height: "72%",
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle at 30% 20%, #facc15, #92400e 65%, #0b1120 100%)",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    padding: 12,
                    color: "#111",
                    fontWeight: 700,
                    fontSize: 14,
                    textShadow:
                      "0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(0,0,0,0.8)",
                  }}
                >
                  <div>Spin to</div>
                  <div>Charge Your</div>
                  <div style={{ fontSize: 18 }}>Zeus Bonus</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSpin}
              disabled={!spinAvailable || spinning}
              style={{
                marginTop: 8,
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: spinAvailable
                  ? "linear-gradient(90deg, #facc15, #f97316)"
                  : "#4b5563",
                color: spinAvailable ? "#000" : "#9ca3af",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: spinAvailable && !spinning ? "pointer" : "default",
                minWidth: 180,
              }}
            >
              {spinning
                ? "Spinning…"
                : spinAvailable
                ? "Spin Now"
                : "Come back tomorrow"}
            </button>

            {selected && (
              <p
                style={{
                  margin: 0,
                  marginTop: 4,
                  fontSize: 13,
                  color: "#e5e7eb",
                  textAlign: "center",
                }}
              >
                Today’s result:{" "}
                <strong style={{ color: "#facc15" }}>{selected.label}</strong>.
                Show this to your host before your next deposit to claim.
              </p>
            )}
          </div>

          {/* Right column: birthday + claim info */}
          <div style={{ display: "grid", gap: 14 }}>
            {/* Birthday box */}
            <section
              style={{
                background: "rgba(15,23,42,0.9)",
                borderRadius: 14,
                border: "1px solid rgba(129,140,248,0.45)",
                padding: 14,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "1.25rem",
                  margin: 0,
                  marginBottom: 6,
                  color: "#bfdbfe",
                }}
              >
                Birthday Bonus 🎂
              </h2>

              {dobStr ? (
                <>
                  <p
                    style={{
                      margin: 0,
                      marginBottom: 4,
                      fontSize: 14,
                      color: "#e5e7eb",
                    }}
                  >
                    Birth date on file:{" "}
                    <strong>
                      {new Date(dobStr).toLocaleDateString()}
                    </strong>
                    .
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: isBirthday ? "#facc15" : "#cbd5f5",
                    }}
                  >
                    {birthdayMessage}
                  </p>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#9ca3af",
                    }}
                  >
                    Birth date is locked after signup to protect age
                    verification and eligibility.
                  </p>
                </>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "#e5e7eb",
                  }}
                >
                  We don&apos;t have a birthday on file. Contact support if you
                  believe this is a mistake.
                </p>
              )}
            </section>

            {/* How to claim */}
            <section
              style={{
                background: "rgba(15,15,25,0.85)",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.5)",
                padding: 14,
                fontSize: 13,
                color: "#e5e7eb",
                lineHeight: 1.6,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "1.15rem",
                  margin: 0,
                  marginBottom: 4,
                  color: "#EED27A",
                }}
              >
                How to Claim Your Bonus
              </h2>
              <ol style={{ paddingLeft: 20, margin: "4px 0 6px" }}>
                <li>Spin your daily wheel in the Bonus Center.</li>
                <li>Screenshot or show your result to a Zeus Lounge host.</li>
                <li>
                  Host applies the match boost or Zeus Coins according to the
                  current promotion rules.
                </li>
              </ol>
              <p style={{ margin: 0, color: "#9ca3af" }}>
                Daily spins, birthday rewards, and Zeus Coins are subject to
                change as promotions update. Ask a host anytime if you&apos;re
                unsure what&apos;s currently active.
              </p>
            </section>
          </div>
        </section>

        {/* Spin history */}
        <section
          style={{
            background: "rgba(15,15,25,0.85)",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.5)",
            padding: 14,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.2rem",
              margin: 0,
              marginBottom: 6,
              color: "#EED27A",
            }}
          >
            Recent Spins
          </h2>

          {historyLoading && (
            <p style={{ fontSize: 14, color: "#e5e7eb", marginTop: 4 }}>
              Loading your history…
            </p>
          )}

          {historyError && (
            <p style={{ fontSize: 14, color: "#fca5a5", marginTop: 4 }}>
              {historyError}
            </p>
          )}

          {!historyLoading && !historyError && history.length === 0 && (
            <p style={{ fontSize: 14, color: "#e5e7eb", marginTop: 4 }}>
              No spins recorded yet. Spin the wheel to log your first bonus!
            </p>
          )}

          {!historyLoading && !historyError && history.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "6px 0 0",
                display: "grid",
                gap: 6,
              }}
            >
              {history.map((row) => {
                const d = new Date(row.created_at);
                return (
                  <li
                    key={row.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 13,
                      borderBottom: "1px dashed rgba(55,65,81,0.7)",
                      paddingBottom: 4,
                    }}
                  >
                    <span style={{ color: "#e5e7eb" }}>
                      {row.result_label}
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

        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 6,
          }}
        >
          Tip: On mobile, the wheel, birthday bonus, and history are stacked so
          you can spin and scroll comfortably with one hand.
        </p>
      </div>

      {/* small responsive tweak for the 2-column section */}
      <style jsx>{`
        @media (max-width: 768px) {
          .bonus-grid-section {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}