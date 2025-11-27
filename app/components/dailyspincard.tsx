"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SpinResult = {
  label: string;
  reward: number;
};

export default function DailySpinCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<string | null>(null);

  async function handleSpin() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // 1) Get current access token from Supabase client
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr) throw sessionErr;

      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Please log in again to spin.");
        setLoading(false);
        return;
      }

      // 2) Call the API route with Authorization header
      const res = await fetch("/api/bonus/daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({} as any));

      if (res.status === 429) {
        // Cooldown
        setCooldownEndsAt(json.cooldownEndsAt || null);
        setMessage("You’ve already spun today. Come back tomorrow.");
        setResult(null);
        return;
      }

      if (!res.ok) {
        throw new Error(json.error || "Spin failed.");
      }

      // success
      setResult({ label: json.label, reward: json.reward });
      setCooldownEndsAt(null);

      if (json.reward > 0) {
        setMessage(`You won ${json.reward} Zeus Coins!`);
      } else {
        setMessage(json.label || "No win this time. Try again tomorrow!");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        borderRadius: 16,
        background: "rgba(15,23,42,0.9)",
        border: "1px solid rgba(148,163,184,0.6)",
        padding: "18px 20px",
        display: "grid",
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontFamily: "var(--font-cinzel, serif)",
          color: "#fbbf24",
        }}
      >
        Daily Zeus Spin
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: "#e5e7eb" }}>
        Spin once every 24 hours for a chance at extra Zeus Coins.
      </p>

      <button
        type="button"
        onClick={handleSpin}
        disabled={loading}
        style={{
          marginTop: 4,
          padding: "10px 16px",
          borderRadius: 999,
          border: "none",
          background:
            "linear-gradient(90deg, #38bdf8, #6366f1, #a855f7)",
          color: "#0b1120",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: loading ? "default" : "pointer",
          width: "fit-content",
        }}
      >
        {loading ? "Spinning…" : "Spin now"}
      </button>

      {message && (
        <p style={{ margin: 0, fontSize: 14, color: "#e5e7eb" }}>
          {message}
        </p>
      )}

      {cooldownEndsAt && (
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
          Next spin available after:{" "}
          {new Date(cooldownEndsAt).toLocaleString()}
        </p>
      )}

      {result && (
        <p style={{ margin: 0, fontSize: 14, color: "#fbbf24" }}>
          Result: <strong>{result.label}</strong>
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </section>
  );
}