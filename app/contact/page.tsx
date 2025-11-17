"use client";

import Link from "next/link";
import React from "react";

export default function ContactPage() {
  const openLiveChat = () => {
    if (typeof window !== "undefined" && (window as any).$crisp) {
      const $crisp = (window as any).$crisp as any[];
      $crisp.push(["do", "chat:show"]);
      $crisp.push(["do", "chat:open"]);
    } else {
      // Fallback if Crisp hasn't loaded yet
      alert("Opening chat… If the widget doesn't appear, please refresh the page.");
    }
  };

  return (
    <main
      className="contact-page"
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        textAlign: "center",
        fontFamily: "'Cinzel Decorative', serif",
      }}
    >
      <section
        className="contact-shell"
        style={{
          width: "100%",
          maxWidth: 820,
          background: "rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,215,0,0.35)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          padding: "2rem",
        }}
      >
        <h1
          className="contact-title"
          style={{
            fontSize: "2.2rem",
            color: "#FFD700",
            textShadow: "0 0 18px rgba(255,215,0,0.45)",
            marginBottom: "1rem",
          }}
        >
          Contact Zeus Lounge
        </h1>

        <p
          className="contact-text"
          style={{
            fontSize: "1.2rem",
            lineHeight: 1.7,
            margin: "0 auto 1.5rem",
            maxWidth: 680,
          }}
        >
          Send us a message on Facebook to play, or{" "}
          <strong>chat with a live agent here on our website</strong> to play{" "}
          <strong>and earn rewards</strong>.
        </p>

        <div
          className="contact-buttons"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            justifyContent: "center",
            marginBottom: "0.75rem",
          }}
        >
          {/* Facebook page/chat link */}
          <a
            href="https://www.facebook.com/profile.php?id=100095134567324"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-button"
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid rgba(255,215,0,0.6)",
              background:
                "linear-gradient(180deg, rgba(255,215,0,0.95), #e5c100)",
              color: "#111",
              fontWeight: 700,
              textDecoration: "none",
              minWidth: 220,
            }}
          >
            Message us on Facebook
          </a>

          {/* Crisp chat launcher */}
          <button
            onClick={openLiveChat}
            className="contact-button"
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid rgba(255,215,0,0.6)",
              background: "transparent",
              color: "#FFD700",
              fontWeight: 700,
              minWidth: 220,
              cursor: "pointer",
            }}
          >
            Chat with a Live Agent
          </button>
        </div>

        <p
          style={{
            color: "#c8c8c8",
            fontSize: "0.95rem",
            marginTop: "0.75rem",
          }}
        >
          Tip: Free play opportunities are posted daily on our Facebook page.
        </p>
      </section>

      {/* Mobile tweaks */}
      <style jsx>{`
        @media (max-width: 768px) {
          .contact-shell {
            padding: 1.5rem 1.25rem;
          }

          .contact-title {
            font-size: 1.8rem;
          }

          .contact-text {
            font-size: 1.05rem;
          }

          .contact-buttons {
            flex-direction: column;
            align-items: stretch;
          }

          .contact-button {
            width: 100%;
            min-width: 0;
          }

          .contact-page {
            padding: 1.5rem 1rem;
          }
        }

        @media (max-width: 400px) {
          .contact-title {
            font-size: 1.6rem;
          }

          .contact-text {
            font-size: 0.98rem;
          }
        }
      `}</style>
    </main>
  );
}