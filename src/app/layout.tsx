import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, JetBrains_Mono, Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BetfairKeepAlive from "@/components/BetfairKeepAlive";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tennis Trader AI | Premium Tennis Trading",
  description:
    "AI-powered tennis trading platform for Betfair Exchange. Professional-grade ladder, real-time signals, and intelligent position management.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${plusJakarta.variable} ${dmSans.variable} antialiased bg-[#030712] text-gray-100`}
        nonce={nonce}
      >
        <Navbar />
        <BetfairKeepAlive />
        {children}
      </body>
    </html>
  );
}
