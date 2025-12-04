"use client";

import { useEffect } from "react";

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
      $crisp.push(["set", "color:theme", "#FFD700"]);

      // Brand header text inside chat
      $crisp.push(["set", "text:header", "Zeus Lounge Support ⚡"]);
      $crisp.push([
        "set",
        "text:welcome",
        "We reply quickly. Ask about today’s free play!",
      ]);

      // ❌ IMPORTANT: no auto “message:send” here anymore

      // If you know who the user is, set identity
      if (props.userEmail) {
        $crisp.push(["set", "user:email", props.userEmail]);
      }
      if (props.userName) {
        $crisp.push(["set", "user:nickname", props.userName]);
      }

      // Optional: custom sidebar data if you ever want it
      // $crisp.push(["set", "session:data", [["Plan", "Olympus"], ["Points", "1,250"]]]);
    };

    init();
  }, [props.userEmail, props.userName]);

  return null;
}