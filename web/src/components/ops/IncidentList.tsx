"use client";

import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

const sev: Record<string, string> = { "SEV-1": "#f87171", "SEV-2": "#fbbf24", "SEV-3": "#38bdf8" };

export default function IncidentList() {
  const incidents = useStore((s) => s.snapshot?.incidents) ?? [];
  return (
    <div className="glass p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Active incidents</p>
      <div className="space-y-2">
        {incidents.map((i) => (
          <div key={i.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${sev[i.severity]}22`, color: sev[i.severity] }}>{i.severity}</span>
                {i.title}
              </span>
              <span className="text-[10px] text-slate-500">{i.zone}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{i.message}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => api.mitigateIncident(i.id)} className="btn !py-1 text-[11px]">Mitigate</button>
              <button onClick={() => api.resolveIncident(i.id)} className="btn !py-1 text-[11px]">Resolve</button>
            </div>
          </div>
        ))}
        {!incidents.length && <p className="text-xs text-slate-600">No active incidents — network nominal.</p>}
      </div>
    </div>
  );
}
