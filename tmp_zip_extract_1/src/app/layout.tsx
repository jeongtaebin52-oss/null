import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AnonInit from "@/components/anon-init";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-custom",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono-custom",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NULL",
  description: "Behavior-first public canvas infrastructure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <AnonInit />
        {children}
      </body>
    </html>
  );
}
