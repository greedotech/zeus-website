"use client";

import { useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link"; // ⬅️ added

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignupPage() {
  const router = useRouter();
  const captchaRef = useRef<ReCAPTCHA>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    dob: "",
    email: "",
    password: "",
  });

  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onChange =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErr(null);
    setMsg(null);

    if (!agree) {
      setErr("Please agree to the terms to continue.");
      return;
    }

    // ---- Age check: must be 21+ ----
    if (!form.dob) {
      setErr("Please enter your birth date.");
      return;
    }
    const today = new Date();
    const dobDate = new Date(form.dob);

    if (isNaN(dobDate.getTime())) {
      setErr("Please enter a valid birth date.");
      return;
    }

    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }

    if (age < 21) {
      setErr("You must be at least 21 years old to create an account.");
      return;
    }

    const token = captchaRef.current?.getValue();
    if (!token) {
      setErr("Please complete the CAPTCHA first.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Verify CAPTCHA
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

      // 2) Sign up user
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            username: form.username,
            dob: form.dob, // also stored in auth metadata
          },
        },
      });
      if (error) {
        setErr(error.message);
        captchaRef.current?.reset();
        setSubmitting(false);
        return;
      }

      // 3) Upsert into profiles table, including DOB
      const userId = data.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert(
          {
            id: userId,
            first_name: form.first_name,
            last_name: form.last_name,
            username: form.username,
            dob: form.dob, // stored as date column
          },
          { onConflict: "id" }
        );
      }

      // 4) Redirect or show confirm message
      if (data.session) {
        setMsg("Account created! Redirecting…");
        router.replace("/account");
      } else {
        setMsg("Check your email to confirm your account, then log in.");
      }
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
        <section className="login-card" aria-labelledby="signup-title">
          <h1 id="signup-title" className="login-title">
            CREATE ACCOUNT ⚡
          </h1>

          <form onSubmit={handleSignup} className="login-form" noValidate>
            <div className="row">
              <label className="label" htmlFor="first_name">
                First name
              </label>
              <input
                id="first_name"
                className="input"
                type="text"
                value={form.first_name}
                onChange={onChange("first_name")}
                required
              />
            </div>

            <div className="row">
              <label className="label" htmlFor="last_name">
                Last name
              </label>
              <input
                id="last_name"
                className="input"
                type="text"
                value={form.last_name}
                onChange={onChange("last_name")}
                required
              />
            </div>

            <div className="row">
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="input"
                type="text"
                value={form.username}
                onChange={onChange("username")}
                required
              />
            </div>

            <div className="row">
              <label className="label" htmlFor="dob">
                Birth date
              </label>
              <input
                id="dob"
                className="input"
                type="date"
                value={form.dob}
                onChange={onChange("dob")}
                required
              />
            </div>

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
                autoComplete="new-password"
                value={form.password}
                onChange={onChange("password")}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="row">
              <div className="label" aria-hidden />
              <label
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 14,
                  color: "#d1d5db",
                }}
              >
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    className="legal-link"
                  >
                    Terms of Service
                  </Link>{" "}
                  &{" "}
                  <Link
                    href="/privacy"
                    className="legal-link"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
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
                {submitting ? "Creating…" : "Create account"}
              </button>
            </div>

            {err && <p className="msg msg-error">{err}</p>}
            {msg && <p className="msg msg-ok">{msg}</p>}

            <p className="signup-hint">
              Already have an account?{" "}
              <a href="/login" className="signup-link">
                Log in
              </a>
            </p>
          </form>
        </section>

        {/* RIGHT: logo (hidden on small screens) */}
        <aside className="login-aside" aria-hidden>
          <img src="/images/logo.jpg" alt="" className="login-logo" />
        </aside>
      </div>

      {/* Reuse the same inline CSS as Login for alignment & mobile */}
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

        .legal-link {
          color: #fbbf24;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 600;
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