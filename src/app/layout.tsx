import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AnonInit from "@/components/anon-init";
import { Providers } from "@/components/providers";
import ConditionalFooter from "@/components/conditional-footer";
import SwRegister from "@/components/sw-register";
import NativeBridgeHost from "@/components/native-bridge-host";

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
  description: "행동 기반 퍼블릭 캔버스 인프라.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased flex min-h-screen flex-col">
        <Providers>
          <AnonInit />
          <NativeBridgeHost />
          <SwRegister />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
