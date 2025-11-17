"use client";

import { useEffect } from "react";

// Optional: if you have user info available, pass it in as props.
// For now we'll just run with defaults and you can wire in data later.
export default function CrispConfig(props: {
  userEmail?: string | null;
  userName?: string | null;
}) {
  useEffect(() => {
    // Wait for Crisp to be available
    const waitForCrisp = () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (typeof window !== "undefined" && (window as any).$crisp) {
            resolve();
          } else {
            setTimeout(check, 150);
          }
        };
        check();
      });

    const init = async () => {
      await waitForCrisp();

      const $crisp = (window as any).$crisp as any[];

      // THEME: Zeus gold
      $crisp.push(["set", "color:theme", "#FFD700"]); // gold
      // Bubble position (bottom-right by default) — uncomment to put it bottom-left:
      // $crisp.push(["config", "position:reverse", true]);

      // Hide “powered by” (if plan supports it)
      // $crisp.push(["config", "hide:on:mobile", false]);

      // Brand welcome (shows in header inside the chat)
      $crisp.push(["set", "text:header", "Zeus Lounge Support ⚡"]);
      // Small status line under header
      $crisp.push(["set", "text:welcome", "We reply quickly. Ask about today’s free play!"]);

      // Optional: only send a one-time greeting message per session
      const greetedKey = "_crisp_greeted";
      if (!sessionStorage.getItem(greetedKey)) {
        // Show the widget and send a friendly first message
        $crisp.push(["do", "chat:show"]);
        $crisp.push([
          "do",
          "message:send",
          [
            "text",
            "Hi there! 👋\nWant info on today’s free play or your points?",
          ],
        ]);
        sessionStorage.setItem(greetedKey, "1");
      }

      // If you know who the user is (from your auth), set their identity
      if (props.userEmail) {
        $crisp.push(["set", "user:email", props.userEmail]);
      }
      if (props.userName) {
        $crisp.push(["set", "user:nickname", props.userName]);
      }

      // Optional: custom fields your agents can see in the sidebar (plan-dependent)
      // $crisp.push(["set", "session:data", [["Plan", "Olympus"], ["Points", "1,250"]]]);
    };

    init();
  }, [props.userEmail, props.userName]);

  return null;
}