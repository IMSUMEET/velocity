"use client";

import { useStore } from "@/lib/store";

const sevColor: Record<string, string> = {
  info: "#38bdf8", warning: "#fbbf24", critical: "#f87171",
};

export default function EventFeed() {
  const events = useStore((s) => s.snapshot?.events) ?? [];
  return (
    <div className="glass flex h-full flex-col p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Live event stream</p>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sevColor[e.severity] ?? "#64748b" }} />
            <span className="w-10 shrink-0 font-mono text-slate-600">t{e.tick}</span>
            <span className="text-slate-300">{e.message}</span>
          </div>
        ))}
        {!events.length && <p className="text-xs text-slate-600">Waiting for events…</p>}
      </div>
    </div>
  );
}
