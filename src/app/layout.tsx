import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
