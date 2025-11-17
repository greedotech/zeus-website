"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AuthButtons() {
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        if (mounted) {
          setUser(null);
          setIsHost(false);
        }
        return;
      }

      setUser(data.user);

      // load profile to check host role
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_host")
        .eq("id", data.user.id)
        .maybeSingle();

      if (mounted) {
        setIsHost(profile?.is_host === true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {user ? (
        <>
          {/* Host link only if is_host = true */}
          {isHost && (
            <Link
              href="/host"
              style={{
                color: "#facc15",
                textDecoration: "none",
                fontWeight: 700,
                border: "1px solid rgba(255,215,0,0.35)",
                padding: "6px 10px",
                borderRadius: 8,
              }}
            >
              ⚡ Host Console
            </Link>
          )}

          <Link
            href="/profile"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Profile
          </Link>

          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,215,0,0.35)",
              padding: "6px 10px",
              color: "white",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="nav-link">
            Login
          </Link>
          <Link href="/signup" className="nav-link">
            Signup
          </Link>
        </>
      )}
    </div>
  );
}