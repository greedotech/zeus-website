"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setMessage(null);

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // The recovery link already signed them in as that user.
      // This just updates the password for the current session user.
      const { error: updErr } = await supabase.auth.updateUser({
        password,
      });

      if (updErr) {
        setError(updErr.message);
        setLoading(false);
        return;
      }

      setMessage("Password updated. You can now log in with your new password.");
      // small delay then send them to login
      setTimeout(() => router.replace("/login"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#000",
        color: "#fff",
        padding: 16,
        fontFamily:
          "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(0,0,0,0.7)",
          borderRadius: 16,
          border: "1px solid #facc15",
          padding: 24,
          boxShadow: "0 6px 30px rgba(0,0,0,0.6)",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 24,
            fontFamily: "var(--font-cinzel, serif)",
            color: "#facc15",
          }}
        >
          Set New Password
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ fontSize: 14 }}>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#111827",
                color: "#fff",
              }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            Confirm password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#111827",
                color: "#fff",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#fbbf24aa" : "#facc15",
              color: "#000",
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Updating..." : "Update password"}
          </button>

          {error && (
            <p style={{ margin: 0, marginTop: 6, fontSize: 14, color: "#fca5a5" }}>
              {error}
            </p>
          )}
          {message && (
            <p style={{ margin: 0, marginTop: 6, fontSize: 14, color: "#86efac" }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}