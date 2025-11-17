"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) setEmail(data.user.email);
      setLoading(false);
    })();
  }, []);

  const reauth = async () => {
    setErr(null);
    const { data: sessionData } = await supabase.auth.getUser();
    const userEmail = sessionData.user?.email;
    if (!userEmail) {
      setErr("You must be logged in.");
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (error) {
      setErr("Current password is incorrect.");
      return false;
    }
    return true;
  };

  const onChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!(await reauth())) return;

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Email updated. You may need to verify the new email.");
    setEmail(newEmail);
    setNewEmail("");
    setCurrentPassword("");
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!(await reauth())) return;

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Password updated.");
    setNewPassword("");
    setCurrentPassword("");
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          background: "#000",
        }}
      >
        Loading…
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <h1>Account Settings</h1>
          <p>
            Signed in as: <strong>{email}</strong>
          </p>
          <p className="hint">
            For your security, you&apos;ll need your <strong>current password</strong> to update
            your email or password.
          </p>
        </header>

        {/* Change Email */}
        <section className="account-card">
          <h2>Change Email</h2>
          <form onSubmit={onChangeEmail} className="account-form" noValidate>
            <label className="field">
              <span className="field-label">Current password</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </label>

            <label className="field">
              <span className="field-label">New email</span>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@email.com"
              />
            </label>

            <button type="submit" className="primary-btn">
              Update email
            </button>
          </form>
        </section>

        {/* Change Password */}
        <section className="account-card">
          <h2>Change Password</h2>
          <form onSubmit={onChangePassword} className="account-form" noValidate>
            <label className="field">
              <span className="field-label">Current password</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </label>

            <label className="field">
              <span className="field-label">New password</span>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New strong password"
              />
            </label>

            <button type="submit" className="primary-btn">
              Update password
            </button>
          </form>
        </section>

        {err && <p className="account-msg error">{err}</p>}
        {msg && <p className="account-msg ok">{msg}</p>}
      </div>

      <style jsx>{`
        .account-page {
          min-height: 100dvh;
          background: #000;
          color: #fff;
          padding: 16px;
          display: flex;
          justify-content: center;
          font-family: var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif);
        }

        .account-shell {
          width: 100%;
          max-width: 900px;
          margin: 88px auto 40px;
          display: grid;
          gap: 18px;
        }

        .account-header h1 {
          font-size: 1.9rem;
          font-weight: 800;
          color: #facc15;
          margin: 0 0 6px;
          font-family: var(--font-cinzel, serif);
          letter-spacing: 0.5px;
        }

        .account-header p {
          margin: 0;
          color: #d1d5db;
          font-size: 0.96rem;
        }

        .account-header .hint {
          margin-top: 8px;
          font-size: 0.88rem;
          color: #9ca3af;
        }

        .account-card {
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid #eab308;
          border-radius: 16px;
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.6);
          padding: 18px 16px 16px;
        }

        .account-card h2 {
          font-size: 1.2rem;
          margin: 0 0 10px;
          color: #ffd700;
          font-family: var(--font-cinzel, serif);
        }

        .account-form {
          display: grid;
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 4px;
          text-align: left;
        }

        .field-label {
          font-size: 0.9rem;
          color: #d1d5db;
        }

        .field input {
          padding: 10px 12px;
          background: #111827;
          color: white;
          border: 1px solid #374151;
          border-radius: 10px;
          outline: none;
          font-size: 0.96rem;
        }

        .field input::placeholder {
          color: #6b7280;
        }

        .primary-btn {
          margin-top: 6px;
          padding: 10px 12px;
          background: #facc15;
          color: #000;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.98rem;
          cursor: pointer;
          min-height: 44px;
        }

        .primary-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .account-msg {
          font-size: 0.9rem;
        }

        .account-msg.error {
          color: #fca5a5;
        }

        .account-msg.ok {
          color: #86efac;
        }

        /* --- Mobile tweaks --- */
        @media (max-width: 768px) {
          .account-shell {
            margin: 80px auto 32px;
            gap: 14px;
          }

          .account-card {
            padding: 16px 14px 14px;
          }

          .account-header h1 {
            font-size: 1.7rem;
            text-align: center;
          }

          .account-header p,
          .account-header .hint {
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .account-page {
            padding: 12px;
          }
          .account-shell {
            margin: 76px auto 28px;
          }
          .account-card {
            border-radius: 14px;
          }
        }
      `}</style>
    </main>
  );
}