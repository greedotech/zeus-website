"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AuthButtons from "./AuthButtons";
import { supabase } from "@/lib/supabaseClient";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  // Watch Supabase auth state so header can react to login/logout
  useEffect(() => {
    let mounted = true;

    // initial check
    supabase.auth.getUser().then(
  (res: import("@supabase/supabase-js").UserResponse) => {
    if (!mounted) return;
    const user = res.data?.user ?? null;
    setLoggedIn(!!user);
  }
);

    // subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(
      (
        _event: import("@supabase/supabase-js").AuthChangeEvent,
        session: import("@supabase/supabase-js").Session | null
      ) => {
        if (!mounted) return;
        setLoggedIn(!!session?.user);
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        backdropFilter: "blur(8px)",
        background:
          "linear-gradient(90deg, rgba(10,10,20,0.55), rgba(10,10,20,0.55))",
        borderBottom: "1px solid rgba(255,215,0,0.25)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          gap: 12,
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontWeight: 900,
              letterSpacing: "1px",
              background: "linear-gradient(to right, #FFD700, #FFF8DC)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 10px rgba(255,255,255,0.35)",
              fontSize: 22,
            }}
          >
            ZEUS LOUNGE
          </span>
        </Link>

        <div
          className="nav-right"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          {/* Desktop links */}
          <div className="links" style={{ display: "none", gap: 18 }}>
            <Link href="/games" className="nav-link">
              Games
            </Link>
            <Link href="/about" className="nav-link">
              About Us
            </Link>
            <Link href="/contact" className="nav-link">
              Contact Us
            </Link>
            <Link href="/social" className="nav-link">
              Social
            </Link>
            <Link href="/media" className="nav-link">
              Media
            </Link>
            {/* Desktop Signup link (optional, AuthButtons also handles auth actions) */}
            <Link href="/signup" className="nav-link">
              Signup
            </Link>
          </div>

          {/* Facebook icon link */}
          <a
            href="https://www.facebook.com/profile.php?id=100095134567324"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Zeus Lounge on Facebook"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid rgba(255,215,0,0.35)",
              background: "rgba(255,215,0,0.05)",
              transition: "all 0.3s ease",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="#FFD700"
              viewBox="0 0 24 24"
              width="18"
              height="18"
            >
              <path d="M22 12.06C22 6.48 17.52 2 11.94 2S2 6.48 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.22.2 2.22.2v2.45h-1.25c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94Z" />
            </svg>
          </a>

          {/* Auth buttons (Profile + Login/Signup/Logout) */}
          <AuthButtons />

          {/* Hamburger */}
          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            style={{
              fontSize: 24,
              lineHeight: 1,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,215,0,0.25)",
              background: "transparent",
              color: "white",
            }}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          style={{
            borderTop: "1px solid rgba(255,215,0,0.25)",
            background: "rgba(10,10,20,0.9)",
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              padding: "10px 16px 16px",
              gap: 10,
            }}
          >
            <Link
              href="/games"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              Games
            </Link>
            <Link
              href="/about"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              About Us
            </Link>
            <Link
              href="/contact"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              Contact Us
            </Link>
            <Link
              href="/social"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              Social
            </Link>
            <Link
              href="/media"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              Media
            </Link>

            {/* This changes based on login status */}
            {loggedIn ? (
              <Link
                href="/profile"
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                Profile
              </Link>
            ) : (
              <Link
                href="/signup"
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                Signup
              </Link>
            )}

            <a
              href="https://www.facebook.com/profile.php?id=100095134567324"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              Facebook Page
            </a>
          </div>
        </div>
      )}

      <style jsx global>{`
        .nav-link {
          color: #f7f7f7;
          text-decoration: none;
          padding: 8px 10px;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        .nav-link:hover {
          background: rgba(255, 215, 0, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.35);
        }
        @media (min-width: 820px) {
          .links {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}