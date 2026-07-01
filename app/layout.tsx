// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cinzel_Decorative, Inter } from "next/font/google";
import Script from "next/script";

import Header from "./components/Header";
import IdleLogoutProvider from "./components/IdleLogoutProvider";

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Zeus Lounge",
  description: "Olympus-themed online sweepstakes",
  icons: { icon: "/favicon.ico" },
};

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
        <Script
          id="respondio__widget"
          src="https://cdn.respond.io/webchat/widget/widget.js?cId=e10c6ba872ef3541496f29d1a1ac329"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${cinzelDecorative.variable} ${inter.variable}`}>
        <IdleLogoutProvider>
          <Header />
          {children}
        </IdleLogoutProvider>
      </body>
    </html>
  );
}