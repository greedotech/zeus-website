"use client";

import { useState, FormEvent } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LoginState = {
  email: string;
  password: string;
};

function LoginInner() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<LoginState>({
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    searchParams.get("message")
  );
  const [err, setErr] = useState<string | null>(null);

  const onChange =
    (field: keyof LoginState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setErr(null);
    setMsg(null);
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        setErr(error.message);
      } else if (data.session) {
        setMsg("Logged in successfully!");
      } else {
        setMsg("Check your email to finish logging in.");
      }
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        {/* LEFT: form */}
        <section className="login-card" aria-labelledby="login-title">
          <h1 id="login-title" className="login-title">
            LOGIN ⚡
          </h1>

          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="row">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={onChange("email")}
                required
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
                autoComplete="current-password"
                value={form.password}
                onChange={onChange("password")}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="row">
              <div className="label" aria-hidden />
              <button
                type="submit"
                disabled={submitting}
                className="submit-btn"
              >
                {submitting ? "Logging in…" : "Log in"}
              </button>
            </div>

            {err && <p className="msg msg-error">{err}</p>}
            {msg && <p className="msg msg-ok">{msg}</p>}
          </form>
        </section>

        {/* RIGHT: logo (hidden on small screens) */}
        <aside className="login-aside" aria-hidden>
          <img src="/images/logo.jpg" alt="" className="login-logo" />
        </aside>
      </div>

      {/* reuse same CSS as signup/login layout */}
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
        }
      `}</style>
    </main>
  );
}

// 👇 This wrapper is what fixes the Vercel build error
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}