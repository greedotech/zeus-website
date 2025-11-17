"use client";

export default function PrivacyPage() {
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
        Privacy Policy
      </h1>

      <p>Last updated: {new Date().toLocaleDateString()}</p>

      <h2>1. Information We Collect</h2>
      <p>We may collect:</p>
      <ul>
        <li>Name and username</li>
        <li>Email address</li>
        <li>Date of birth (for eligibility verification)</li>
        <li>Zeus Coin totals and activity</li>
        <li>Login session information</li>
        <li>Voluntary information from Facebook interactions or screenshots</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <p>We use collected data to:</p>
      <ul>
        <li>Maintain your account</li>
        <li>Verify eligibility</li>
        <li>Award coins and apply bonuses</li>
        <li>Provide customer support</li>
        <li>Improve the platform</li>
      </ul>

      <h2>3. Data Storage</h2>
      <p>
        User account information is securely stored using Supabase. We do not
        sell or share your data with third parties.
      </p>

      <h2>4. Social Media Data</h2>
      <p>
        We may verify your Facebook interactions when awarding coins. We do not
        store any passwords or private Facebook information.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Zeus Lounge may use cookies to maintain your login session and improve
        site performance. These cookies do not contain sensitive information.
      </p>

      <h2>6. Data Deletion</h2>
      <p>
        You may request account deletion at any time through our support
        channels. Deleted accounts cannot be recovered.
      </p>

      <h2>7. Security</h2>
      <p>
        We take reasonable measures to protect your data. No online platform can
        guarantee absolute security, but we follow industry-standard
        practices.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        Changes to this Privacy Policy will be posted on this page. Continued
        use of Zeus Lounge after updates implies acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this policy may be sent through Facebook or our live
        chat system.
      </p>
    </main>
  );
}