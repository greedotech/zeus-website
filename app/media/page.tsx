"use client";

import React, { useMemo, useState } from "react";

type MediaType = "image" | "video";

type MediaItem = {
  id: string;
  type: MediaType;
  title: string;
  description?: string;
  platform?: string;
  thumb: string; // thumbnail image
  src: string;   // full image or video url
};

// 🔹 Sample data – replace thumb/src with your real files later
const MEDIA_ITEMS: MediaItem[] = [
  {
    id: "clip1",
    type: "video",
    title: "Mega Win – Gates of Olympus",
    description: "A thunderous hit on a $1 stake.",
    platform: "Zeus Lounge",
    thumb: "/media/thumbs/clip1.jpg",
    src: "/media/videos/clip1.mp4",
  },
  {
    id: "clip2",
    type: "image",
    title: "Jackpot Screenshot",
    description: "Clean $500 hit on a bonus round.",
    platform: "Zeus Lounge",
    thumb: "/media/thumbs/clip2.jpg",
    src: "/media/images/clip2.jpg",
  },
  // Add lots more items here…
];

const PAGE_SIZE = 12;

type FilterKey = "all" | "video" | "image";

export default function MediaPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filtered list + pagination
  const filteredAll = useMemo(
    () =>
      MEDIA_ITEMS.filter((item) =>
        filter === "all" ? true : item.type === filter
      ),
    [filter]
  );

  const filtered = useMemo(
    () => filteredAll.slice(0, visibleCount),
    [filteredAll, visibleCount]
  );

  const canLoadMore = visibleCount < filteredAll.length;

  const activeItem = useMemo(
    () => filteredAll.find((i) => i.id === activeId) ?? null,
    [filteredAll, activeId]
  );

  // Reset pagination when filter changes
  const handleFilterChange = (next: FilterKey) => {
    setFilter(next);
    setActiveId(null);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#f9fafb",
        padding: "84px 16px 32px",
        fontFamily:
          "var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        {/* Header */}
        <header>
          <h1
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "2.4rem",
              margin: 0,
              background: "linear-gradient(to right, #FFD700, #FFF8DC)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 15px rgba(255,255,255,0.45)",
            }}
          >
            Zeus Lounge Media
          </h1>
          <p style={{ marginTop: 8, color: "#d1d5db", maxWidth: 620 }}>
            Watch real gameplay clips, big wins, and highlight reels from the
            Zeus Lounge community.
          </p>
        </header>

        {/* Filter pills */}
        <section
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <FilterPill
            label="All"
            active={filter === "all"}
            onClick={() => handleFilterChange("all")}
          />
          <FilterPill
            label="Videos"
            active={filter === "video"}
            onClick={() => handleFilterChange("video")}
          />
          <FilterPill
            label="Screenshots"
            active={filter === "image"}
            onClick={() => handleFilterChange("image")}
          />
          <span
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginLeft: "auto",
            }}
          >
            Showing {filtered.length} of {filteredAll.length} clip
            {filteredAll.length === 1 ? "" : "s"}
          </span>
        </section>

        {/* Gallery grid */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, min(220px, 32vw)))",
            gap: 14,
            justifyContent: "center",
          }}
        >
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              style={{
                position: "relative",
                border: "none",
                padding: 0,
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
                background:
                  "radial-gradient(circle at 0 0, rgba(250,204,21,0.16), rgba(15,23,42,1))",
                boxShadow:
                  "0 10px 30px rgba(0,0,0,0.8), 0 0 18px rgba(250,204,21,0.18)",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  paddingBottom: "56.25%",
                  overflow: "hidden",
                }}
              >
                <img
                  src={item.thumb}
                  alt={item.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scale(1.02)",
                    transition: "transform 200ms ease",
                  }}
                />
                {item.type === "video" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow:
                          "0 0 12px rgba(0,0,0,0.9), 0 0 12px rgba(250,204,21,0.6)",
                      }}
                    >
                      <div
                        style={{
                          marginLeft: 3,
                          width: 0,
                          height: 0,
                          borderTop: "9px solid transparent",
                          borderBottom: "9px solid transparent",
                          borderLeft: "14px solid #facc15",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: "8px 10px 10px",
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "#f9fafb",
                    marginBottom: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </div>
                {item.platform && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                    }}
                  >
                    {item.platform}
                  </div>
                )}
              </div>
            </button>
          ))}
        </section>

        {/* Load more button */}
        {canLoadMore && (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(250,204,21,0.8)",
                background: "linear-gradient(90deg, #facc15, #f97316)",
                color: "#111827",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Load more clips
            </button>
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          Tip: Tap any clip to view it full screen. On mobile, turn your phone
          sideways for a wider view.
        </p>
      </div>

      {/* Lightbox overlay */}
      {activeItem && (
        <div
          onClick={() => setActiveId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "min(960px, 100%)",
              width: "100%",
              maxHeight: "90vh",
              background: "#020617",
              borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.45)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
              padding: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label="Close media viewer"
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.95)",
                color: "#e5e7eb",
                fontSize: 20,
                width: 30,
                height: 30,
                cursor: "pointer",
              }}
            >
              ×
            </button>

            <div
              style={{
                position: "relative",
                width: "100%",
                paddingBottom: "56.25%",
                background: "#020617",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {activeItem.type === "video" ? (
                <video
                  src={activeItem.src}
                  controls
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    background: "#000",
                  }}
                />
              ) : (
                <img
                  src={activeItem.src}
                  alt={activeItem.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    background: "#000",
                  }}
                />
              )}
            </div>

            <div
              style={{
                padding: "4px 4px 2px",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: "#f9fafb",
                  marginBottom: 2,
                }}
              >
                {activeItem.title}
              </div>
              {activeItem.description && (
                <div style={{ color: "#cbd5f5", marginBottom: 2 }}>
                  {activeItem.description}
                </div>
              )}
              {activeItem.platform && (
                <div style={{ color: "#9ca3af", fontSize: 12 }}>
                  Platform: {activeItem.platform}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(250,204,21,0.8)"
          : "1px solid rgba(75,85,99,0.9)",
        background: active
          ? "linear-gradient(90deg, rgba(250,204,21,0.2), rgba(250,204,21,0.05))"
          : "rgba(15,23,42,0.9)",
        color: active ? "#facc15" : "#e5e7eb",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}