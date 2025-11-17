"use client";

import React, { useEffect, useRef } from "react";

/** Bold, branched lightning with extra glow (unchanged) */
function Lightning({ side }: { side: "left" | "right" }) {
  const sideStyle: React.CSSProperties =
    side === "left" ? { left: "10%" } : { right: "10%" };

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 250,
        ...sideStyle,
        width: 180,
        height: 320,
        zIndex: 6, // above columns/logo/text
        pointerEvents: "none",
        mixBlendMode: "screen",
        filter: "drop-shadow(0 0 20px rgba(255,255,255,0.8))",
      }}
      className="lightning-wrap"
    >
      <svg viewBox="0 0 180 320" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <defs>
          <filter id="boltGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="burstGrad" cx="50%" cy="20%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#c8d9ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#c8d9ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="90" cy="44" r="70" fill="url(#burstGrad)" className="bolt-burst" />
        <polyline
          points="90,0 76,55 108,84 62,130 96,162 60,214 92,248 72,286 86,320"
          stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"
          filter="url(#boltGlow)" className={`bolt trunk ${side}`}
        />
        <polyline
          points="76,98 44,120 66,146"
          stroke="#e6eeff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"
          filter="url(#boltGlow)" className={`bolt branchA ${side}`}
        />
        <polyline
          points="98,176 128,194 112,222"
          stroke="#e6eeff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"
          filter="url(#boltGlow)" className={`bolt branchB ${side}`}
        />
      </svg>
    </div>
  );
}

export default function Home() {
  // Parallax refs (unchanged)
  const mountainsRef = useRef<HTMLImageElement | null>(null);
  const cloudsBackLeftRef = useRef<HTMLImageElement | null>(null);
  const cloudsBackRightRef = useRef<HTMLImageElement | null>(null);
  const cloudsFrontLeftRef = useRef<HTMLImageElement | null>(null);
  const cloudsFrontRightRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    const apply = (el: HTMLElement | null, y: number) => {
      if (!el) return;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        apply(mountainsRef.current, y * 0.12);
        apply(cloudsBackLeftRef.current, y * 0.18);
        apply(cloudsBackRightRef.current, y * 0.18);
        apply(cloudsFrontLeftRef.current, y * 0.28);
        apply(cloudsFrontRightRef.current, y * 0.28);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "84px",
        overflow: "hidden",
        background: `
          url('https://www.transparenttextures.com/patterns/marble.png'),
          radial-gradient(circle at 30% 40%, #ffffff, #f5f5f5 70%)
        `,
        backgroundRepeat: "repeat",
        backgroundSize: "300px 300px",
        fontFamily: "'Cinzel Decorative', serif",
        touchAction: "manipulation",
      }}
      className="olympus-stage"
    >
      {/* Mountains */}
      <img
        ref={mountainsRef}
        src="/images/mountains.svg"
        alt="Mount Olympus"
        style={{
          width: "100%",
          maxHeight: "420px",
          objectFit: "cover",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          opacity: 0.95,
          filter: "drop-shadow(0 0 30px rgba(255,255,255,0.6)) brightness(1.15)",
          pointerEvents: "none",
          willChange: "transform",
        }}
      />

      {/* Title overlay */}
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 0,
          right: 0,
          height: 160,
          background:
            "linear-gradient(to bottom, rgba(10,15,35,0.45), rgba(10,15,35,0.15), rgba(10,15,35,0))",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Title */}
      <h1
        style={{
          fontSize: "clamp(1.8rem, 5vw + 0.4rem, 3.8rem)",
          background: "linear-gradient(to right, #FFD700, #FFF8DC)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 15px #FFD700, 0 0 30px rgba(255,255,255,0.85)",
          marginTop: "1rem",
          marginBottom: "1rem",
          zIndex: 3,
          textAlign: "center",
          letterSpacing: "1px",
          lineHeight: 1.1,
        }}
      >
        ⚡ WELCOME TO THE ZEUS LOUNGE ⚡
      </h1>

      {/* Columns + Logo + Clouds */}
      <div
        style={{
          position: "absolute",
          top: 340,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "92%",
          maxWidth: "1250px",
          zIndex: 3,
          gap: "2vw",
        }}
      >
        {/* Soft gold line along columns top */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: "2%",
            right: "2%",
            height: 2,
            background:
              "linear-gradient(90deg, rgba(255,215,0,0), rgba(255,215,0,0.85), rgba(255,215,0,0))",
            boxShadow: "0 0 10px rgba(255,215,0,0.5)",
            borderRadius: 2,
            zIndex: 5,
          }}
        />

        {/* Left statue */}
        <img
          src="/images/ZeusFL.svg"
          alt="Statue watermark left"
          className="wm-left"
          style={{
            position: "absolute",
            bottom: "60px",
            left: "calc(50% - 1040px)",
            width: "860px",
            opacity: 0.26,
            zIndex: 3,
            filter:
              "grayscale(100%) contrast(135%) drop-shadow(0 8px 26px rgba(0,0,0,0.3))",
            mixBlendMode: "soft-light",
            pointerEvents: "none",
          }}
        />

        {/* Right statue */}
        <img
          src="/images/zeusFR.svg"
          alt="Statue watermark right"
          className="wm-right"
          style={{
            position: "absolute",
            bottom: "60px",
            left: "calc(50% + 160px)",
            width: "860px",
            opacity: 0.26,
            zIndex: 3,
            filter:
              "grayscale(100%) contrast(135%) drop-shadow(0 8px 26px rgba(0,0,0,0.3))",
            mixBlendMode: "soft-light",
            pointerEvents: "none",
          }}
        />

        {/* BACK clouds */}
        <img
          ref={cloudsBackLeftRef}
          src="/images/clouds1.png"
          alt="Cloud left back"
          style={{
            position: "absolute",
            bottom: 40,
            left: -220,
            width: 320,
            opacity: 0.55,
            zIndex: 2,
            pointerEvents: "none",
            willChange: "transform",
            animation: "driftX 72s linear infinite",
          }}
        />
        <img
          ref={cloudsBackRightRef}
          src="/images/clouds2.png"
          alt="Cloud right back"
          style={{
            position: "absolute",
            bottom: 80,
            right: -260,
            width: 360,
            opacity: 0.55,
            zIndex: 2,
            pointerEvents: "none",
            willChange: "transform",
            animation: "driftX 84s linear infinite reverse",
          }}
        />

        {/* LEFT column */}
        <img
          src="/images/column1.svg"
          alt="Column Left"
          className="column-img"
          style={{
            height: 560,
            maxHeight: "76vh",
            zIndex: 4,
            animation: "shimmer 8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        {/* CENTER: lightning + logo + tagline */}
        <div
          style={{
            maxWidth: 620,
            textAlign: "center",
            position: "relative",
            zIndex: 5,
            margin: "0 2vw",
          }}
        >
          <Lightning side="left" />
          <Lightning side="right" />

          {/* Logo */}
          <img
            src="/images/logo.jpg"
            alt="Zeus Lounge Logo"
            className="logo-img"
            style={{
              display: "block",
              margin: "80px auto 10px",
              width: "40vw",
              maxWidth: 420,
              minWidth: 220,
              pointerEvents: "none",
              animation: "divineGlow 6s ease-in-out infinite",
            }}
          />

          <div
            className="welcome-text"
            style={{
              display: "inline-block",
              padding: "14px 18px",
              marginTop: 6,
              borderRadius: 10,
              background:
                "linear-gradient(180deg, rgba(40,40,40,0.55), rgba(30,30,30,0.45))",
              border: "1px solid rgba(255,215,0,0.45)",
              boxShadow:
                "0 6px 18px rgba(0,0,0,0.35), inset 0 0 12px rgba(255,215,0,0.15)",
              color: "#EED27A",
              textShadow:
                "0 0 10px rgba(0,0,0,0.65), 0 0 14px rgba(255,215,0,0.35)",
              fontSize: "clamp(0.95rem, 1.2vw + 0.6rem, 1.1rem)",
              lineHeight: "1.5rem",
              letterSpacing: "0.3px",
              maxWidth: 620,
            }}
          >
            ENTER THE REALM OF OLYMPUS. THE GODS ARE WATCHING, LIGHTNING STRIKES THE
            SKIES, AND FORTUNE AWAITS THOSE BOLD ENOUGH TO PLAY.
          </div>
        </div>

        {/* RIGHT column */}
        <img
          src="/images/column2.svg"
          alt="Column Right"
          className="column-img"
          style={{
            height: 560,
            maxHeight: "76vh",
            zIndex: 4,
            animation: "shimmer 8s ease-in-out infinite reverse",
            pointerEvents: "none",
          }}
        />

        {/* FRONT clouds */}
        <img
          ref={cloudsFrontLeftRef}
          src="/images/clouds1.png"
          alt="Cloud front left"
          style={{
            position: "absolute",
            bottom: 20,
            left: -160,
            width: 300,
            opacity: 0.7,
            zIndex: 5,
            pointerEvents: "none",
            willChange: "transform",
            animation: "driftX 80s linear infinite",
          }}
        />
        <img
          ref={cloudsFrontRightRef}
          src="/images/clouds2.png"
          alt="Cloud front right"
          style={{
            position: "absolute",
            bottom: 58,
            right: -190,
            width: 320,
            opacity: 0.7,
            zIndex: 5,
            pointerEvents: "none",
            willChange: "transform",
            animation: "driftX 74s linear infinite reverse",
          }}
        />
      </div>

      {/* Spacer for scroll (reduced so phones don't feel too long) */}
      <div style={{ height: "80vh" }} />

      {/* Keyframes + mobile tweaks */}
      <style jsx global>{`
        @keyframes driftX {
          0% { transform: translateX(0); }
          100% { transform: translateX(420px); }
        }
        @keyframes shimmer {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(255,215,0,0)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,215,0,0.35)); }
        }
        @keyframes divineGlow {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(255,255,255,0.4)) drop-shadow(0 0 0 rgba(255,215,0,0));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(255,255,255,0.7)) drop-shadow(0 0 12px rgba(255,215,0,0.45));
          }
        }
        .bolt { opacity: 0; animation: boltFlash 6.5s infinite; }
        .bolt.trunk.left { animation-delay: 0.6s; }
        .bolt.branchA.left { animation-delay: 0.75s; }
        .bolt.branchB.left { animation-delay: 0.9s; }
        .bolt.trunk.right { animation-delay: 3.2s; }
        .bolt.branchA.right { animation-delay: 3.35s; }
        .bolt.branchB.right { animation-delay: 3.5s; }
        .bolt-burst { opacity: 0; animation: burstFlash 6.5s infinite; }
        @keyframes boltFlash {
          0%, 93%, 100% { opacity: 0; }
          94% { opacity: 0.95; }
          95% { opacity: 0.25; }
          96% { opacity: 0.8; }
          97% { opacity: 0.15; }
          98% { opacity: 0.5; }
          99% { opacity: 0.05; }
        }
        @keyframes burstFlash {
          0%, 93%, 100% { opacity: 0; }
          94% { opacity: 0.7; }
          96% { opacity: 0.15; }
          98% { opacity: 0.35; }
        }

        /* ---------- Mobile-first tune-ups ---------- */
        @media (max-width: 768px) {
          /* Pull the whole stage up slightly on tablets/phones */
          .olympus-stage { padding-top: 72px !important; }

          /* Columns shorter on small screens, keep them aligned */
          .column-img {
            height: 44vh !important;
            max-height: 44vh !important;
          }

          /* Logo scales gracefully */
          .logo-img {
            width: clamp(56vw, 62vw, 72vw) !important;
            max-width: 360px !important;
            margin: 56px auto 8px !important;
          }

          /* Welcome text: a little tighter */
          .welcome-text {
            padding: 10px 12px !important;
            line-height: 1.45rem !important;
          }

          /* Lightning smaller & a tad lower so it doesn't crowd */
          .lightning-wrap {
            top: 220px !important;
            width: 130px !important;
            height: 240px !important;
          }

          /* Statues: scale down & keep aligned with logo base */
          .wm-left, .wm-right {
            width: 68vw !important;
            opacity: 0.22 !important;
            bottom: 48px !important;
          }
          .wm-left { left: calc(50% - 92vw) !important; }
          .wm-right { left: calc(50% + 18vw) !important; }
        }

        /* Very small phones */
        @media (max-width: 420px) {
          .column-img { height: 38vh !important; }
          .logo-img { width: 72vw !important; max-width: 300px !important; }
          .wm-left, .wm-right { display: none !important; } /* hide statues if too cramped */
        }
      `}</style>
    </main>
  );
}