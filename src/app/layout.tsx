import type { Metadata } from "next";
import { Bricolage_Grotesque, Cormorant_Garamond, Fraunces, Inter, Outfit } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pages101",
  description: "Safe, casting-ready actor pages for young performers."
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap"
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap"
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  display: "swap"
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${outfit.variable} ${bricolage.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
