"use client";
import Link from "next/link"

export default function AboutPage() {
  return (
    <>
      <main
        style={{
          position: "relative",
          maxWidth: 1100,
          margin: "0 auto",
          padding: "120px 20px 80px",
          color: "var(--foreground, #f5f6fb)",
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "3rem",
            marginBottom: 12,
            background: "linear-gradient(to right, #FFD700, #FFF8DC)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 15px rgba(255,255,255,0.5)",
            letterSpacing: "0.5px",
          }}
        >
          About Zeus Lounge
        </h1>
        <p style={{ opacity: 0.9, marginBottom: 28 }}>
          Olympus-themed online sweepstakes where community, fairness, and fun
          take center stage.
        </p>

        {/* Mission */}
        <section
          style={{
            background: "rgba(20,20,30,0.55)",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 14,
            padding: "22px 20px",
            marginBottom: 24,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.8rem",
              marginBottom: 10,
              color: "#EED27A",
            }}
          >
            Our Mission
          </h2>
          <p style={{ lineHeight: 1.7 }}>
            To craft an immersive, mythology-inspired sweepstakes experience
            where every player feels welcome, every game is transparent, and
            every reward system is fair. We celebrate the spirit of friendly
            competition and the thrill of chance—guided by community rules,
            responsible play, and modern security.
          </p>
        </section>

        {/* What we stand for */}
        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            marginBottom: 24,
          }}
        >
          {[
            {
              title: "Fairness",
              body:
                "Clear rules, published odds where applicable, and auditable promotion terms. We work to keep mechanics understandable and consistent.",
            },
            {
              title: "Security",
              body:
                "Accounts protected with modern authentication. Sensitive data is handled with care and never shared without consent.",
            },
            {
              title: "Community",
              body:
                "Respectful, inclusive spaces. We reward positive participation and routinely host themed events and giveaways.",
            },
            {
              title: "Responsibility",
              body:
                "Self-service account tools, age gates, and reminders to play within limits. We want fun, not pressure.",
            },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                background: "rgba(20,20,30,0.5)",
                border: "1px solid rgba(255,215,0,0.22)",
                borderRadius: 12,
                padding: "16px 16px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "1.2rem",
                  marginBottom: 8,
                  color: "#EED27A",
                }}
              >
                {card.title}
              </h3>
              <p style={{ opacity: 0.95, lineHeight: 1.6 }}>{card.body}</p>
            </div>
          ))}
        </section>

        {/* Points & promotions */}
        <section
          style={{
            background: "rgba(20,20,30,0.55)",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 14,
            padding: "22px 20px",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.6rem",
              marginBottom: 10,
              color: "#EED27A",
            }}
          >
            Points, Rewards & Promotions
          </h2>
          <ul style={{ lineHeight: 1.75, paddingLeft: 18, margin: 0 }}>
            <li>Earn points by participating in eligible gameplay and events.</li>
            <li>Points unlock sweepstakes entries, perks, and seasonal rewards.</li>
            <li>
              Promotions have clearly posted Terms &amp; Conditions and eligibility
              rules.
            </li>
            <li>
              Leaderboards and streaks are audited for fairness and abuse prevention.
            </li>
          </ul>
        </section>

        {/* Compliance */}
        <section
          style={{
            background: "rgba(20,20,30,0.55)",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 14,
            padding: "22px 20px",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.6rem",
              marginBottom: 10,
              color: "#EED27A",
            }}
          >
            Compliance & Eligibility
          </h2>
          <p style={{ lineHeight: 1.7, marginBottom: 10 }}>
            Zeus Lounge is designed as an online sweepstakes experience. Access may
            be limited by age and location. Where required, we verify eligibility
            and may request additional information to fulfill compliance obligations.
          </p>
          <ul style={{ lineHeight: 1.75, paddingLeft: 18, margin: 0 }}>
            <li>Age-gated entry (e.g., 21+ where applicable).</li>
            <li>Geographic restrictions may apply based on local rules.</li>
            <li>One account per person; fraudulent behavior leads to disqualification.</li>
            <li>Responsible play guidelines and self-service account tools are available.</li>
          </ul>
        </section>

        {/* Contact / Support */}
        <section
          style={{
            background: "rgba(20,20,30,0.55)",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 14,
            padding: "22px 20px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "1.6rem",
              marginBottom: 10,
              color: "#EED27A",
            }}
          >
            Questions? Reach Out.
          </h2>
          <p style={{ lineHeight: 1.7 }}>
            We’re here to help. For account issues, promotions, or partnership
            opportunities:
            <br />
            <strong>Email:</strong> support@zeuslounge.example
          </p>
        </section>
      </main>

      {/* Small mobile tweak */}
      <style jsx>{`
        @media (max-width: 768px) {
          main {
            padding: 96px 16px 40px;
          }
        }
      `}</style>
    </>
  );
 <footer style={{ marginTop: 40, textAlign: "center" }}>
  <Link
    href="/terms"
    style={{ color: "#FFD700", marginRight: 20, textDecoration: "none" }}
  >
    Terms of Service
  </Link>
  <Link
    href="/privacy"
    style={{ color: "#FFD700", textDecoration: "none" }}
  >
    Privacy Policy
  </Link>
</footer> 
}