"use client";

import { useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!captchaToken) {
      setErr("Please complete the CAPTCHA first.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      });
      if (error) throw error;
      setMsg("If an account exists for that email, a reset link has been sent.");
    } catch (e: any) {
      setErr(e.message || "Unable to send reset email.");
    } finally {
      resetCaptcha(); // hCaptcha tokens are single-use
      setSending(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "rgba(0,0,0,0.7)", border: "1px solid #eab308", borderRadius: 16, padding: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#facc15", marginBottom: 16, textAlign: "center" }}>
          Reset your password
        </h1>
        <form onSubmit={onSubmit}>
          <label style={{ display: "block", marginBottom: 8, color: "#d1d5db" }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%", padding: "10px 12px", background: "#111827", color: "#fff", border: "1px solid #374151", borderRadius: 10, marginBottom: 12 }}
          />
          <div className="captcha-wrap" style={{ marginBottom: 12 }}>
            <HCaptcha ref={captchaRef} sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!} theme="dark" onVerify={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken(null)} />
          </div>
          <button
            type="submit"
            disabled={sending}
            style={{ width: "100%", padding: "10px 12px", background: "#facc15", color: "#000", border: "none", borderRadius: 10, fontWeight: 700 }}
          >
            {sending ? "Sending…" : "Send reset link"}
          </button>
          {err && <p style={{ color: "#fca5a5", marginTop: 10 }}>{err}</p>}
          {msg && <p style={{ color: "#86efac", marginTop: 10 }}>{msg}</p>}
        </form>
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <a href="/login" style={{ color: "#facc15", textDecoration: "underline" }}>Back to login</a>
        </p>
      </div>
    </main>
  );
}