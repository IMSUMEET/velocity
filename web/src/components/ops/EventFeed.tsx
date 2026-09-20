"use client";

import { useStore } from "@/lib/store";

const sevColor: Record<string, string> = { info: "#2563eb", warning: "#d97706", critical: "#dc2626" };

export default function EventFeed() {
  const events = useStore((s) => s.snapshot?.events) ?? [];
  return (
    <div className="card flex h-full flex-col p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse2" /> Live event stream
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sevColor[e.severity] ?? "#94a3b8" }} />
            <span className="w-10 shrink-0 font-mono text-ink-faint">t{e.tick}</span>
            <span className="text-ink-soft">{e.message}</span>
          </div>
        ))}
        {!events.length && <p className="text-xs text-ink-faint">Waiting for events…</p>}
      </div>
    </div>
  );
}
