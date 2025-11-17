"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  dob: string | null;
  zeus_coins: number | null;
  referral_code: string | null;
  referred_by: string | null; // UUID of inviter
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [inviterName, setInviterName] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // ---------- Load profile ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          setErr("You must be logged in to view your profile.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username, dob, zeus_coins, referral_code, referred_by")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        setProfile(
          data || {
            id: user.id,
            first_name: user.user_metadata?.first_name ?? null,
            last_name: user.user_metadata?.last_name ?? null,
            username: user.user_metadata?.username ?? null,
            dob: user.user_metadata?.dob ?? null,
            zeus_coins: 0,
            referral_code: user.user_metadata?.referral_code ?? null,
            referred_by: null,
          }
        );
      } catch (e: any) {
        if (!mounted) return;
        setErr(e.message || "Unable to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------- Build invite link when we have a referral_code ----------
  useEffect(() => {
    if (!profile?.referral_code) {
      setInviteLink(null);
      return;
    }
    if (typeof window === "undefined") return;

    const origin = window.location.origin;
    setInviteLink(`${origin}/signup?ref=${encodeURIComponent(profile.referral_code)}`);
  }, [profile?.referral_code]);

  // ---------- Lookup inviter (referred_by UUID) ----------
  useEffect(() => {
    const loadInviter = async () => {
      if (!profile?.referred_by) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, referral_code")
          .eq("id", profile.referred_by)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setInviterName("House / Not set");
          return;
        }

        setInviterName(data.username || data.referral_code || "House / Not set");
      } catch {
        setInviterName("House / Not set");
      }
    };

    loadInviter();
  }, [profile?.referred_by]);

  const handleCopyLink = () => {
    if (!inviteLink || typeof navigator === "undefined") return;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        setCopyMsg("Invite link copied! Share it with friends.");
        setTimeout(() => setCopyMsg(null), 2500);
      })
      .catch(() => {
        setCopyMsg("Unable to copy. You can select and copy the link manually.");
        setTimeout(() => setCopyMsg(null), 3500);
      });
  };

  // ---------- Derived values ----------
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
        Loading profile…
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

  const coins = profile?.zeus_coins ?? 0;
  const fullName =
    (profile?.first_name || profile?.last_name)
      ? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim()
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
          maxWidth: 920,
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
            Your Olympus Profile
          </h1>
          <p style={{ marginTop: 8, color: "#d1d5db" }}>
            Manage your Zeus Lounge identity, track your coins, and explore rewards.
          </p>
        </header>

        {/* Top summary: name + coins + quick links */}
        <section
          style={{
            background: "rgba(0,0,0,0.7)",
            borderRadius: 16,
            border: "1px solid #eab308",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: "#9ca3af" }}>Player</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {fullName || profile?.username || "Olympus Adventurer"}
              </div>
              {profile?.username && (
                <div style={{ fontSize: 14, color: "#9ca3af" }}>
                  @{profile.username}
                </div>
              )}
            </div>

            {/* Coins + shortcuts */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {/* Zeus Coins pill */}
              <div
                style={{
                  minWidth: 150,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(250,204,21,0.7)",
                  background:
                    "radial-gradient(circle at 0 0, rgba(250,204,21,0.28), transparent 60%)",
                  boxShadow: "0 0 18px rgba(250,204,21,0.18)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#facc15",
                  }}
                >
                  Zeus Coins
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#fef9c3",
                  }}
                >
                  {coins.toLocaleString()}
                </div>
              </div>

              {/* Rewards + Bonus buttons */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Link
                  href="/rewards"
                  style={{
                    textDecoration: "none",
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,215,0,0.6)",
                    background: "rgba(24,24,30,0.8)",
                    color: "#facc15",
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ Zeus Rewards
                </Link>
                <Link
                  href="/bonus"
                  style={{
                    textDecoration: "none",
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(129,140,248,0.7)",
                    background: "rgba(15,23,42,0.9)",
                    color: "#bfdbfe",
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  🎁 Bonus Center
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Profile details */}
        <section
          style={{
            background: "rgba(15,15,25,0.8)",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.4)",
            padding: 16,
            display: "grid",
            gap: 10,
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
            Profile Details
          </h2>

          <InfoRow label="Name" value={fullName || "Not set"} />
          <InfoRow label="Username" value={profile?.username || "Not set"} />
          <InfoRow
            label="Birth date"
            value={
              profile?.dob
                ? new Date(profile.dob).toLocaleDateString()
                : "Not set"
            }
          />

          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#9ca3af",
            }}
          >
            Birth date is locked after account creation to protect eligibility
            and security. If you think something is wrong, contact a host.
          </p>

          {/* Account settings link */}
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
            }}
          >
            <Link
              href="/account"
              style={{
                color: "#93c5fd",
                textDecoration: "underline",
                fontWeight: 500,
              }}
            >
              ⚙️ Account Settings
            </Link>
          </div>
        </section>

        {/* Referral & invites */}
        <section
          style={{
            background: "rgba(12,20,35,0.9)",
            borderRadius: 14,
            border: "1px solid rgba(59,130,246,0.6)",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.3rem",
              margin: 0,
              marginBottom: 4,
              color: "#bfdbfe",
            }}
          >
            Referral & Invites
          </h2>

          <InfoRow
            label="Referred by"
            value={inviterName || "House / Not set"}
          />

          <InfoRow
            label="Your invite code"
            value={profile?.referral_code || "Not assigned yet"}
          />

          {inviteLink && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                fontSize: 13,
                marginTop: 6,
              }}
            >
              <span style={{ color: "#9ca3af" }}>Your invite link</span>
              <span
                style={{
                  wordBreak: "break-all",
                  fontWeight: 500,
                  color: "#e5e7eb",
                  flex: "1 1 auto",
                }}
              >
                {inviteLink}
              </span>

              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(96,165,250,0.8)",
                  background: "rgba(15,23,42,0.95)",
                  color: "#dbeafe",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Copy link
              </button>
            </div>
          )}

          {copyMsg && (
            <p
              style={{
                margin: 0,
                marginTop: 4,
                fontSize: 12,
                color: "#bbf7d0",
              }}
            >
              {copyMsg}
            </p>
          )}

          <p
            style={{
              margin: 0,
              marginTop: 6,
              fontSize: 12,
              color: "#9ca3af",
            }}
          >
            Share your invite link with friends. When they join and make a
            qualifying deposit, hosts can award you bonus Zeus Coins according
            to the current referral promotion.
          </p>
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