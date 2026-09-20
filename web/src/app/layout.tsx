import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AppFrame from "@/components/AppFrame";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "VeloCity — Dispatch Strategy Lab",
  description:
    "Which dispatch strategy wins the cost-vs-speed trade-off in last-mile delivery? VeloCity answers it with reproducible, seeded experiments — and lets you watch why on a live city map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
