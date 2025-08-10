import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Huub — Portfolio",
  description: "Interactive WebGL portfolio by Huub van Veenhuijzen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
