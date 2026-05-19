"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If they opened this page without a valid recovery session, Supabase won't let updateUser work.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus("This reset link is invalid or expired. Please request a new one.");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setStatus("Password updated! Redirecting to login...");
      setTimeout(() => router.push("/login"), 900);
    } catch (err: any) {
      setStatus(err?.message || "Unable to reset password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "96px 16px 32px",
        display: "grid",
        placeItems: "center",
        fontFamily:
          "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 16,
          border: "1px solid rgba(255,215,0,0.35)",
          background: "rgba(15,23,42,0.9)",
          padding: 18,
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: 6,
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "1.8rem",
            color: "#facc15",
          }}
        >
          Reset Password
        </h1>
        <p style={{ marginTop: 0, color: "#cbd5e1", fontSize: 13 }}>
          Enter a new password for your account.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 13, color: "#e5e7eb" }}>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={{
                marginTop: 4,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </label>

          <label style={{ fontSize: 13, color: "#e5e7eb" }}>
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
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(90deg, #facc15, #f97316)",
              color: "#111827",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              marginTop: 6,
            }}
          >
            {saving ? "Saving..." : "Update password"}
          </button>

          {status && (
            <p style={{ margin: 0, marginTop: 6, fontSize: 13, color: "#e5e7eb" }}>
              {status}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}