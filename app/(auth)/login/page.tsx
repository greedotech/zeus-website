"use client";

import { useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const reason = search.get("reason");

  const captchaRef = useRef<ReCAPTCHA>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErr(null);
    setMsg(null);

    const token = captchaRef.current?.getValue();
    if (!token) {
      setErr("Please complete the CAPTCHA first.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) verify CAPTCHA
      const verifyRes = await fetch("/api/recaptcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.success) {
        setErr("CAPTCHA verification failed. Please try again.");
        captchaRef.current?.reset();
        setSubmitting(false);
        return;
      }

      // 2) Supabase login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErr(error.message);
        captchaRef.current?.reset();
        setSubmitting(false);
        return;
      }

      setMsg("Success! Redirecting…");
      captchaRef.current?.reset();
      router.replace("/account");
    } catch {
      setErr("Something went wrong. Please try again.");
      captchaRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-shell">
        {/* LEFT: form */}
        <section className="login-card" aria-labelledby="login-title">
          <h1 id="login-title" className="login-title">
            ZEUS LOUNGE LOGIN ⚡
          </h1>

          {reason === "idle" && (
            <div className="idle-banner">
              You were signed out after a period of inactivity.
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="row">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="row">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <div className="row">
              <div className="label" aria-hidden />
              <div className="captcha-wrap">
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                  theme="dark"
                />
              </div>
            </div>

            <div className="row">
              <div className="label" aria-hidden />
              <button
                type="submit"
                disabled={submitting}
                className="submit-btn"
              >
                {submitting ? "Signing in…" : "Login"}
              </button>
            </div>

            {/* Forgot password + messages */}
            <div className="row small-row">
              <div className="label" aria-hidden />
              <div className="helper-links">
                <a href="/forgot-password" className="helper-link">
                  Forgot username / password?
                </a>
              </div>
            </div>

            {err && <p className="msg msg-error">{err}</p>}
            {msg && <p className="msg msg-ok">{msg}</p>}

            <p className="signup-hint">
              Don’t have an account?{" "}
              <a href="/signup" className="signup-link">
                Create one
              </a>
            </p>
          </form>
        </section>

        {/* RIGHT: logo (hidden on small screens) */}
        <aside className="login-aside" aria-hidden>
          <img src="/images/logo.jpg" alt="" className="login-logo" />
        </aside>
      </div>

      {/* shared styles with signup (mobile-first) */}
      <style jsx>{`
        .login-page {
          min-height: 100dvh;
          width: 100%;
          background: #000;
          color: #fff;
          display: grid;
          place-items: center;
          padding: 16px;
          overflow: hidden;
          font-family: var(
            --font-inter,
            system-ui,
            -apple-system,
            Segoe UI,
            Roboto,
            sans-serif
          );
        }
        .login-shell {
          width: 100%;
          max-width: 1000px;
          display: grid;
          grid-template-columns: 520px 1fr;
          gap: 24px;
          align-items: center;
        }
        .login-card {
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid #eab308;
          border-radius: 16px;
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.6);
          padding: 24px;
        }
        .login-title {
          font-size: 28px;
          font-weight: 800;
          color: #facc15;
          margin: 0 0 16px;
          font-family: var(--font-cinzel, serif);
          letter-spacing: 0.5px;
        }
        .idle-banner {
          margin: 6px 0 12px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #fcd34d;
          background: rgba(254, 243, 199, 0.95);
          color: #713f12;
          font-size: 14px;
        }
        .login-form {
          display: grid;
          gap: 12px;
        }
        .row {
          display: grid;
          grid-template-columns: 128px 1fr;
          align-items: center;
          gap: 12px;
        }
        .small-row {
          margin-top: -4px;
        }
        .label {
          width: 128px;
          font-size: 16px;
          color: #d1d5db;
        }
        .input {
          font-size: 16px;
          padding: 10px 12px;
          background: #111827;
          color: white;
          border: 1px solid #374151;
          border-radius: 10px;
          outline: none;
        }
        .captcha-wrap {
          transform-origin: 0 0;
        }
        .submit-btn {
          padding: 10px 12px;
          background: #facc15;
          color: #000;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          min-height: 44px;
        }
        .submit-btn[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .helper-links {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 13px;
        }
        .helper-link {
          color: #facc15;
          text-decoration: underline;
        }
        .msg {
          font-size: 14px;
          margin: 8px 0 0;
        }
        .msg-error {
          color: #fca5a5;
        }
        .msg-ok {
          color: #86efac;
        }
        .signup-hint {
          margin-top: 16px;
          text-align: center;
          font-size: 14px;
          color: #d1d5db;
        }
        .signup-link {
          color: #facc15;
          text-decoration: underline;
        }
        .login-aside {
          display: grid;
          place-items: center;
        }
        .login-logo {
          width: min(220px, 28vw);
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 0 18px rgba(255, 215, 0, 0.25));
        }

        @media (max-width: 820px) {
          .login-shell {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .login-aside {
            display: none;
          }
          .login-card {
            padding: 20px;
          }
          .row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .label {
            width: auto;
          }
          .captcha-wrap {
            transform: scale(0.92);
          }
        }

        @media (max-width: 360px) {
          .captcha-wrap {
            transform: scale(0.85);
          }
        }
      `}</style>
    </main>
  );
}