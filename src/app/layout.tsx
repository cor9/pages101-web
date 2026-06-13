import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pages101",
  description: "Safe, casting-ready actor pages for young performers."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
