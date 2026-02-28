import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Asshat Fantasy 2026",
  description: "Are you ready to dominate the waiver wire?",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${outfit.variable} font-sans bg-zinc-950 text-white antialiased selection:bg-indigo-500/30`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
