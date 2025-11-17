"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const IDLE_MINUTES = 120; // ← “a few hours”. Change to what you want.
const IDLE_MS = IDLE_MINUTES * 60 * 1000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function IdleLogoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // only logout if truly idle (tab might be throttled)
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_MS) {
        await supabase.auth.signOut();
        router.replace("/login?reason=idle");
      }
    }, IDLE_MS);
  };

  useEffect(() => {
    resetTimer();

    const onActivity = () => resetTimer();
    const onVisibility = () => {
      // if user returns after a long time, enforce immediately
      if (document.visibilityState === "visible") {
        const idleFor = Date.now() - lastActivityRef.current;
        if (idleFor >= IDLE_MS) {
          supabase.auth.signOut().then(() => router.replace("/login?reason=idle"));
        } else {
          resetTimer();
        }
      }
    };

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("mousedown", onActivity);
    window.addEventListener("touchstart", onActivity);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("mousedown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return <>{children}</>;
}