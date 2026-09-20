"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { useLiveFeed } from "@/lib/useLiveFeed";
import { useStore } from "@/lib/store";

const tabs = [
  { href: "/", label: "Lab" },
  { href: "/operations", label: "Operations" },
  { href: "/fleet", label: "Fleet & Orders" },
  { href: "/method", label: "Method" },
];

export default function AppFrame({ children }: { children: React.ReactNode }) {
  useLiveFeed();
  const pathname = usePathname();
  const connected = useStore((s) => s.connected);
  const tick = useStore((s) => s.snapshot?.tick ?? 0);

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 pb-16 md:px-6">
      <header className="sticky top-0 z-30 -mx-4 mb-6 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/"><Brand /></Link>
          <nav className="hidden rounded-full border border-line bg-surface p-1 shadow-card md:flex">
            {tabs.map((t) => {
              const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    active ? "bg-accent text-white shadow-card" : "text-ink-soft hover:text-ink"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="chip">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-good animate-pulse2" : "bg-bad"}`} />
            {connected ? `live · t${tick}` : "connecting…"}
          </div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto md:hidden">
          {tabs.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-accent text-white" : "bg-surface text-ink-soft border border-line"}`}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
