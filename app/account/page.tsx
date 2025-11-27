"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getTierProgress, getTierLabel } from "@/lib/tiers";

type ProfileBits = {
  id: string;
  zeus_coins: number | null;
  email: string | null;
};

export default function AccountPage() {
  const [profile, setProfile] = useState<ProfileBits | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          if (!mounted) return;
          setErr("You must be logged in to manage your account.");
          setLoading(false);
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
          email: user.email ?? null,
        });
      } catch (e: any) {
        if (!mounted) return;
        setErr(e.message || "Unable to load account.");
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
        Loading account…
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

  if (!profile) {
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
        <p>Please log in to view your account.</p>
      </main>
    );
  }

  const coins = profile.zeus_coins ?? 0;
  const tierProgress = getTierProgress(coins);
  const tierLabel = getTierLabel(tierProgress.current);
  const tierText = `${tierProgress.current} — ${tierLabel}`;

  // Simple 0–100 for visual bar
  const progressPercent = Math.max(
    0,
    Math.min(100, tierProgress.percentToNext ?? 100)
  );

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
          maxWidth: 820,
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
              fontSize: "2.2rem",
              margin: 0,
              color: "#facc15",
            }}
          >
            Account & Tier
          </h1>
          <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 14 }}>
            View your Zeus Lounge account info and track your tier progression.
          </p>
        </header>

        {/* Account info */}
        <section
          style={{
            background: "rgba(15,23,42,0.9)",
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.6)",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 6,
              fontFamily: "var(--font-cinzel), serif",
              fontSize: 16,
              color: "#e5e7eb",
            }}
          >
            Account Details
          </h2>
          <InfoRow label="Email" value={profile.email || "Not set"} />
          <InfoRow
            label="Zeus Coins"
            value={coins.toLocaleString()}
          />
        </section>

        {/* Tier progression */}
        <section
          style={{
            background: "rgba(12,20,35,0.95)",
            borderRadius: 16,
            border: "1px solid rgba(59,130,246,0.7)",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 6,
              fontFamily: "var(--font-cinzel), serif",
              fontSize: 16,
              color: "#bfdbfe",
            }}
          >
            Tier Progression
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#e5e7eb",
            }}
          >
            Current tier:{" "}
            <strong style={{ color: "#facc15" }}>{tierText}</strong>
          </p>

          {tierProgress.next && tierProgress.neededForNext !== null && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              {tierProgress.neededForNext! > 0 ? (
                <>
                  You need{" "}
                  <strong>
                    {tierProgress.neededForNext!.toLocaleString()}
                  </strong>{" "}
                  more Zeus Coins to reach{" "}
                  <strong>{tierProgress.next}</strong>.
                </>
              ) : (
                <>You’re eligible for the next tier upgrade.</>
              )}
            </p>
          )}

          {/* Progress bar */}
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              <span>Standard</span>
              <span>Silver</span>
              <span>Gold</span>
              <span>Diamond</span>
            </div>
            <div
              style={{
                position: "relative",
                height: 10,
                borderRadius: 999,
                background: "rgba(15,23,42,0.9)",
                overflow: "hidden",
                border: "1px solid rgba(148,163,184,0.6)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg,#22c55e,#eab308,#f97316,#a855f7)",
                  width: `${progressPercent}%`,
                  transformOrigin: "left center",
                  transition: "width 0.6s ease-out",
                }}
              />
            </div>
          </div>

          {/* Static perk summary */}
          <ul
            style={{
              margin: 0,
              marginTop: 6,
              paddingLeft: 18,
              fontSize: 12,
              color: "#d1d5db",
              display: "grid",
              gap: 2,
            }}
          >
            <li>
              <strong>Standard:</strong> No fees on deposits, standard redeem
              fees apply.
            </li>
            <li>
              <strong>Silver:</strong> We cover 50% of platform redeem fees.
            </li>
            <li>
              <strong>Gold:</strong> We cover 100% of platform redeem fees.
            </li>
            <li>
              <strong>Diamond:</strong> 100% of platform redeem fees + 5% match
              on deposits over $50.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 14,
      }}
    >
      <span style={{ color: "#9ca3af" }}>{props.label}</span>
      <span style={{ fontWeight: 500 }}>{props.value}</span>
    </div>
  );
}