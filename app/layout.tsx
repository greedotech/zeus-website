// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cinzel_Decorative, Inter } from "next/font/google";
import Script from "next/script";

import Header from "./components/Header";
import CrispConfig from "./components/CrispConfig";
import IdleLogoutProvider from "./components/IdleLogoutProvider";

// Greek-style display for headings
const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
});

// Clean, legible body font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Zeus Lounge",
  description: "Olympus-themed online sweepstakes",
  icons: { icon: "/favicon.ico" },
};

// Mobile-friendly viewport (prevents iOS zoom quirks and respects safe areas)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Crisp embed (loads once, after hydration) */}
        <Script
          id="crisp-chat"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.$crisp = [];
              window.CRISP_WEBSITE_ID = "8a15a42a-8366-4d26-83a8-6a0c26d18e58";
              (function () {
                var d = document;
                var s = d.createElement("script");
                s.src = "https://client.crisp.chat/l.js";
                s.async = 1;
                d.getElementsByTagName("head")[0].appendChild(s);
              })();
            `,
          }}
        />
      </head>
      <body className={`${cinzelDecorative.variable} ${inter.variable}`}>
        <IdleLogoutProvider>
          {/* Site-wide navigation (appears on every page) */}
          <Header />

          {/* Crisp customization (runs after window.$crisp exists) */}
          <CrispConfig />

          {/* Page content */}
          {children}
        </IdleLogoutProvider>
      </body>
    </html>
  );
}