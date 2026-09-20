"use client";

import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

const sev: Record<string, string> = { "SEV-1": "#dc2626", "SEV-2": "#d97706", "SEV-3": "#2563eb" };

export default function IncidentList() {
  const incidents = useStore((s) => s.snapshot?.incidents) ?? [];
  return (
    <div className="card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Active incidents</p>
      <div className="space-y-2">
        {incidents.map((i) => (
          <div key={i.id} className="rounded-lg border border-line bg-inset p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${sev[i.severity]}1a`, color: sev[i.severity] }}>{i.severity}</span>
                {i.title}
              </span>
              <span className="text-[10px] text-ink-faint">{i.zone}</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{i.message}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => api.mitigateIncident(i.id)} className="btn !py-1 text-[11px]">Mitigate</button>
              <button onClick={() => api.resolveIncident(i.id)} className="btn !py-1 text-[11px]">Resolve</button>
            </div>
          </div>
        ))}
        {!incidents.length && <p className="text-xs text-ink-faint">No active incidents — network nominal.</p>}
      </div>
    </div>
  );
}
