import type { Metadata } from "next";
import { Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mandate — bounded autonomy for tokenized stocks",
  description:
    "A non-custodial robo-advisor on Robinhood Chain. Give an AI agent a mandate inside a cage the blockchain enforces — it physically cannot drain you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <div className="relative min-h-screen">
            <div className="pointer-events-none fixed inset-0 grid-overlay opacity-[0.5]" />
            <NavBar />
            <main className="relative">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
