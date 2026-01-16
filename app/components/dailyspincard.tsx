"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SpinResult = {
  label: string;
  value: number;
  type: "coins" | "match" | "freeplay" | "none";
};

export default function DailySpinCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<string | null>(null);

  async function handleSpin() {
    if (loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // 1) Make sure we have a session
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      console.log("daily spin – session:", session, "err:", sessionErr);

      if (sessionErr) {
        console.error("daily spin - session error:", sessionErr);
        setError("Please log in again to spin.");
        return;
      }

      if (!session?.user) {
        setError("Please log in to spin.");
        return;
      }

      // 2) Call the API route – cookies handle auth
      const res = await fetch("/api/bonus/daily", {
        method: "POST",
      });

      const json = await res.json().catch(() => ({} as any));
      console.log("daily spin – api response:", res.status, json);

      if (res.status === 429) {
        setCooldownEndsAt(json.cooldownEndsAt || null);
        setMessage("You’ve already spun today. Come back tomorrow.");
        setResult(null);
        return;
      }

      if (!res.ok) {
        throw new Error(json.error || "Spin failed.");
      }

      const spin: SpinResult = {
        label: json.label ?? "Spin complete",
        value: typeof json.value === "number" ? json.value : 0,
        type: (json.type as SpinResult["type"]) ?? "none",
      };

      setResult(spin);
      setCooldownEndsAt(null);

      if (spin.type === "coins" && spin.value > 0) {
        setMessage(`You won ${spin.value} Zeus Coins!`);
      } else {
        setMessage(spin.label || "No win this time. Try again tomorrow!");
      }
    } catch (e: any) {
      console.error("daily spin - client error:", e);
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
          background: "linear-gradient(90deg, #38bdf8, #6366f1, #a855f7)",
          color: "#0b1120",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: loading ? "default" : "pointer",
          width: "fit-content",
          opacity: loading ? 0.75 : 1,
        }}
      >
        {loading ? "Spinning…" : "Spin now"}
      </button>

      {message && (
        <p style={{ margin: 0, fontSize: 14, color: "#e5e7eb" }}>{message}</p>
      )}

      {cooldownEndsAt && (
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
          Next spin available after: {new Date(cooldownEndsAt).toLocaleString()}
        </p>
      )}

      {result && (
        <p style={{ margin: 0, fontSize: 14, color: "#fbbf24" }}>
          Result: <strong>{result.label}</strong>
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#fca5a5" }}>{error}</p>
      )}
    </section>
  );
}