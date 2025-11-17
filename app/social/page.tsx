"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export default function SocialPage() {
  // Reviews (keep your filenames)
  const slides = useMemo(
    () => [
      { src: "/images/reviews/review1.png", alt: "Customer review 1" },
      { src: "/images/reviews/review2.png", alt: "Customer review 2" },
      { src: "/images/reviews/review3.png", alt: "Customer review 3" },
      { src: "/images/reviews/review4.png", alt: "Customer review 4" },
      { src: "/images/reviews/review5.png", alt: "Customer review 5" },
      { src: "/images/reviews/review6.png", alt: "Customer review 6" },
      { src: "/images/reviews/review7.png", alt: "Customer review 7" },
      { src: "/images/reviews/review8.png", alt: "Customer review 8" },
      { src: "/images/reviews/review9.png", alt: "Customer review 9" },
      { src: "/images/reviews/review10.png", alt: "Customer review 10" },
      { src: "/images/reviews/review11.png", alt: "Customer review 11" },
      { src: "/images/reviews/review12.png", alt: "Customer review 12" },
      { src: "/images/reviews/review13.png", alt: "Customer review 13" },
      { src: "/images/reviews/review14.png", alt: "Customer review 14" },
      { src: "/images/reviews/review15.png", alt: "Customer review 15" },
      { src: "/images/reviews/review16.png", alt: "Customer review 16" },
      { src: "/images/reviews/review17.png", alt: "Customer review 17" },
      { src: "/images/reviews/review18.png", alt: "Customer review 18" },
      { src: "/images/reviews/review19.png", alt: "Customer review 19" },
      { src: "/images/reviews/review20.png", alt: "Customer review 20" },
      { src: "/images/reviews/review21.png", alt: "Customer review 21" },
      { src: "/images/reviews/review22.png", alt: "Customer review 22" },
      { src: "/images/reviews/review24.png", alt: "Customer review 24" },
      { src: "/images/reviews/review25.png", alt: "Customer review 25" },
      { src: "/images/reviews/review26.png", alt: "Customer review 26" },
      { src: "/images/reviews/review27.png", alt: "Customer review 27" },
      { src: "/images/reviews/review28.png", alt: "Customer review 28" },
      { src: "/images/reviews/review29.png", alt: "Customer review 29" },
      { src: "/images/reviews/review30.png", alt: "Customer review 30" },
    ],
    []
  );

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Auto-rotate every 5s
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = window.setTimeout(
      () => setIdx((i) => (i + 1) % slides.length),
      5000
    );
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [idx, paused, slides.length]);

  const go = (dir: 1 | -1) => setIdx((i) => (i + dir + slides.length) % slides.length);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#000",
        color: "white",
        fontFamily: "'Cinzel Decorative', serif",
        overflowX: "hidden",
        paddingBottom: "1.5rem",
      }}
    >
      {/* Banner (no crop, responsive height) */}
      <section
        style={{
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 12px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            maxHeight: 320,
            background:
              "radial-gradient(1200px 300px at 50% 100%, rgba(255,215,0,0.15), rgba(0,0,0,0) 60%)",
          }}
        >
          <img
            src="/images/playersclub.jpg"
            alt="Zeus Lounge Players Club"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              boxShadow: "inset 0 -50px 90px rgba(0,0,0,0.45)",
            }}
          />
        </div>
      </section>

      {/* Callout */}
      <section
        style={{
          maxWidth: 900,
          margin: "0.75rem auto 0.4rem",
          padding: "0 16px",
          textAlign: "center",
          fontSize: "clamp(0.95rem, 2.6vw, 1.1rem)",
          lineHeight: 1.6,
        }}
      >
        <p>
          Join our{" "}
          <Link
            href="https://www.facebook.com/share/g/1L5gHyVwP8/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#FFD700",
              textDecoration: "underline",
              fontWeight: 700,
            }}
          >
            group page
          </Link>{" "}
          on Facebook to connect and interact with other players, share your
          winnings, and learn more about different platforms.
        </p>
      </section>

      {/* Reviews Carousel (compact & mobile-friendly) */}
      <section
        style={{
          maxWidth: 780,
          margin: "0.4rem auto 1.25rem",
          padding: "0 12px",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: "#FFD700",
            textShadow: "0 0 10px rgba(255,215,0,0.35)",
            marginBottom: "0.4rem",
            fontSize: "clamp(1.2rem, 2.8vw, 1.4rem)",
          }}
        >
          What Players Are Saying
        </h2>

        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          style={{
            position: "relative",
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,215,0,0.35)",
            borderRadius: 12,
            padding: 8,
            overflow: "hidden",
          }}
        >
          {/* Stage: fixed but responsive height -> smaller on phones */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "min(260px, 60vw)",
            }}
          >
            {slides.map((s, i) => (
              <img
                key={s.src}
                src={s.src}
                alt={s.alt}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "center",
                  transition: "opacity 400ms ease",
                  opacity: i === idx ? 1 : 0,
                }}
              />
            ))}
          </div>

          {/* Arrows (tappable, not huge) */}
          <button
            aria-label="Previous review"
            onClick={() => go(-1)}
            style={arrowStyle("left")}
          >
            ‹
          </button>
          <button
            aria-label="Next review"
            onClick={() => go(1)}
            style={arrowStyle("right")}
          >
            ›
          </button>

          {/* Dots */}
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 6,
            }}
          >
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,215,0,0.7)",
                  background:
                    i === idx ? "rgba(255,215,0,0.9)" : "transparent",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid rgba(255,215,0,0.6)",
    background: "rgba(0,0,0,0.5)",
    color: "#FFD700",
    fontSize: 22,
    lineHeight: "32px",
    textAlign: "center",
    cursor: "pointer",
    userSelect: "none",
  };
  return side === "left" ? { ...base, left: 8 } : { ...base, right: 8 };
}