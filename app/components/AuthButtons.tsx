"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type SimpleUser = {
  id: string;
  email?: string;
};

export default function AuthButtons() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [isHost, setIsHost] = useState(false);

  async function loadHostFlag(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_host")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("AuthButtons loadHostFlag error:", error);
        setIsHost(false);
        return;
      }

      setIsHost(!!data?.is_host);
    } catch (e) {
      console.error("AuthButtons loadHostFlag threw:", e);
      setIsHost(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const syncFromSession = async () => {
      try {
        // getSession is safer than getUser for your current setup
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("AuthButtons getSession error:", error);
          setUser(null);
          setIsHost(false);
          return;
        }

        const sessionUser = data.session?.user ?? null;

        if (!sessionUser) {
          setUser(null);
          setIsHost(false);
          return;
        }

        setUser({ id: sessionUser.id, email: sessionUser.email ?? undefined });
        await loadHostFlag(sessionUser.id);
      } catch (e) {
        console.error("AuthButtons syncFromSession threw:", e);
        if (mounted) {
          setUser(null);
          setIsHost(false);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    syncFromSession();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        const sessionUser = session?.user ?? null;

        if (!sessionUser) {
          setUser(null);
          setIsHost(false);
          setChecking(false);
          return;
        }

        setUser({ id: sessionUser.id, email: sessionUser.email ?? undefined });
        await loadHostFlag(sessionUser.id);
        setChecking(false);
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      // force clean UI state after signOut
      window.location.href = "/";
    }
  };

  if (checking) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#f9fafb", opacity: 0.7, fontSize: 14 }}>
          Loading…
        </span>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/login" className="nav-link nav-pill">
          Login
        </Link>
        <Link href="/signup" className="nav-link nav-pill">
          Signup
        </Link>
      </div>
    );
  }

  // Logged in
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {isHost && (
        <Link href="/host" className="nav-link nav-pill">
          ⚡ Host Console
        </Link>
      )}

      <Link href="/profile" className="nav-link nav-pill">
        Profile
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="nav-link nav-pill"
        style={{
          border: "none",
          cursor: "pointer",
          padding: "8px 14px",
          fontSize: 14,
          fontWeight: 600,
          background: "linear-gradient(90deg, #facc15, #fb923c)",
          color: "#111827",
        }}
      >
        Logout
      </button>
    </div>
  );
}