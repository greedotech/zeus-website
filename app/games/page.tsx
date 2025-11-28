"use client";

import React, { useState } from "react";

type Game = {
  slug: string;
  title: string;
  image: string;
  description: string;
};

const games: Game[] = [
  {
    slug: "fire-kirin",
    title: "FIRE KIRIN",
    image: "/logos/firekirin.jpg",
    description: "Arcade-style fish shooter with dynamic multipliers.",
  },
  {
    slug: "fire-phoenix",
    title: "FIRE PHOENIX",
    image: "/logos/firephoenix.jpg",
    description: "Reborn reels and fiery jackpots await.",
  },
  {
    slug: "gamevault",
    title: "GAMEVAULT",
    image: "/logos/gamevault.jpg",
    description: "A vault of entertainment and bonuses.",
  },
  {
    slug: "golden-dragon",
    title: "GOLDEN DRAGON",
    image: "/logos/goldendragon.jpg",
    description: "Golden scales and flame-breathing prizes.",
  },
  {
    slug: "juwa",
    title: "JUWA",
    image: "/logos/juwa.jpg",
    description: "Neon-style slots and fish games with daily rewards.",
  },
  {
    slug: "king-kong",
    title: "KING KONG",
    image: "/logos/kingkong.jpg",
    description: "Jungle mayhem with mega multipliers.",
  },
  {
    slug: "lucky-stars",
    title: "LUCKY STARS",
    image: "/logos/luckystars.jpg",
    description: "Bright cosmic reels and star-powered spins.",
  },
  {
    slug: "mega-spins",
    title: "MEGA SPINS",
    image: "/logos/megaspin.jpg",
    description: "Fast spins and epic momentum rounds.",
  },
  {
    slug: "milky-way",
    title: "MILKY WAY",
    image: "/logos/milkyway.jpg",
    description: "Galaxy reels with infinite possibilities.",
  },
  {
    slug: "noble",
    title: "NOBLE",
    image: "/logos/noble.jpg",
    description: "Regal-themed games with high-paying bonuses.",
  },
  {
    slug: "nova-play",
    title: "NOVA PLAY",
    image: "/logos/novaplay.jpg",
    description: "Cosmic visuals and supernova jackpots.",
  },
  {
    slug: "orion-stars",
    title: "ORION STARS",
    image: "/logos/orionstars.jpg",
    description: "Galaxy-inspired slots with constellation jackpots.",
  },
  {
    slug: "pandora-games",
    title: "PANDORA",
    image: "/logos/pandora.jpg",
    description: "Mythic reels—open the box for big rewards.",
  },
  {
    slug: "riversweeps",
    title: "RIVERSWEEPS",
    image: "/logos/riversweeps.jpg",
    description: "Smooth cascading reels with hidden wins.",
  },
  {
    slug: "ultra-panda",
    title: "ULTRA PANDA",
    image: "/logos/ultrapanda.jpg",
    description: "Panda-themed reels, easy bonuses, and wild fun.",
  },
  {
    slug: "v-blink",
    title: "V BLINK",
    image: "/logos/vblink.jpg",
    description: "High-velocity sweeps hub with lightning-fast spins.",
  },
  {
    slug: "vegas-x",
    title: "VEGAS X",
    image: "/logos/vegasx.jpg",
    description: "Neon Vegas energy and classic gameplay.",
  },
  {
    slug: "golden-city",
    title: "GOLDEN CITY",
    image: "/logos/Goldencity.jpg", // case matches file
    description: "Shimmering streets, golden bonuses, and massive wins.",
  },
];

export default function GamesPage() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #0a0a1a, #1b1b3a)",
        color: "white",
        padding: "2rem",
        fontFamily: "'Cinzel Decorative', serif",
        touchAction: "manipulation",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "clamp(1.8rem, 4.5vw + 0.5rem, 3rem)",
          marginBottom: "0.5rem",
          color: "#FFD700",
        }}
      >
        ⚡ Zeus Lounge Games ⚡
      </h1>

      <p
        style={{
          textAlign: "center",
          marginBottom: "2rem",
          fontSize: "1rem",
          color: "#e7c95a",
        }}
      >
        On mobile: <strong>tap a tile</strong> to see its description. On
        desktop: <strong>hover</strong> a tile.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1.5rem",
          justifyItems: "center",
        }}
      >
        {games.map((game) => {
          const isActive = active === game.slug;

          return (
            <div
              key={game.slug}
              role="button"
              aria-label={`${game.title} tile`}
              tabIndex={0}
              onClick={() => setActive(isActive ? null : game.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive(isActive ? null : game.slug);
                }
              }}
              onMouseEnter={() => setActive(game.slug)}
              onMouseLeave={() => setActive(null)}
              style={{
                width: "min(220px, 42vw)",
                aspectRatio: "1 / 1",
                position: "relative",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 0 15px rgba(255, 215, 0, 0.4)",
                cursor: "pointer",
                background: "#111",
                transition: "transform 0.25s ease",
                transform: isActive ? "scale(1.05)" : "scale(1)",
                userSelect: "none",
              }}
            >
              {isActive ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "1rem",
                    fontSize: "0.95rem",
                    lineHeight: "1.4rem",
                  }}
                >
                  <p>{game.description}</p>
                </div>
              ) : (
                <img
                  src={game.image}
                  alt={game.title}
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}