"use client";

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "80px 20px",
        fontFamily: "var(--font-inter, sans-serif)",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-cinzel), serif",
          fontSize: "2.3rem",
          marginBottom: 20,
        }}
      >
        Terms of Service
      </h1>

      <p>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 21 years old to create an account or participate in
        any activity on Zeus Lounge. By using this website, you confirm that you
        meet this requirement.
      </p>

      <h2>2. Nature of the Platform</h2>
      <p>
        Zeus Lounge is a social entertainment platform. Bonuses, matches, and
        rewards are promotional in nature and are manually applied by hosts
        after verification. Zeus Lounge does not provide real-money gambling and
        makes no guarantee of financial gain.
      </p>

      <h2>3. Account Responsibilities</h2>
      <p>
        You are responsible for maintaining the confidentiality of your login
        credentials. You agree to notify us immediately of any unauthorized use
        of your account.
      </p>

      <h2>4. Coins & Rewards</h2>
      <p>
        Zeus Coins have no cash value and cannot be sold, traded, transferred,
        or exchanged for money. Coins may be awarded by hosts for deposits or
        community engagement. All rewards must be verified and applied by an
        authorized host.
      </p>

      <h2>5. Prohibited Activity</h2>
      <ul>
        <li>Creating multiple accounts</li>
        <li>Falsifying screenshots or interactions</li>
        <li>Attempting to exploit rewards or bonuses</li>
        <li>Harassment or abuse toward staff or other players</li>
      </ul>

      <h2>6. Bonus Application</h2>
      <p>
        Bonuses and match offers must be applied manually by a Zeus Lounge host.
        All bonus decisions are final. Abuse or misuse may result in loss of
        rewards or account restrictions.
      </p>

      <h2>7. Social Media Interaction</h2>
      <p>
        Coins awarded for Facebook or social media engagement require proof
        (screenshots, links, or host verification). Zeus Lounge is not liable
        for platform outages, bans, or restrictions imposed by third-party
        services.
      </p>

      <h2>8. Termination</h2>
      <p>
        Zeus Lounge may suspend or terminate accounts for misconduct or
        violation of these Terms.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        Zeus Lounge provides this platform “as is.” We are not responsible for
        losses, downtime, or errors occurring on the site, nor for actions of
        third-party platforms like Facebook or payment providers.
      </p>

      <h2>10. Contact</h2>
      <p>
        For questions about these Terms, please contact us via Facebook or the
        website’s live chat system.
      </p>
    </main>
  );
}