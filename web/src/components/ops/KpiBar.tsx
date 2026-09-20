"use client";

import { useStore } from "@/lib/store";
import { fmt, healthColor } from "@/lib/ui";

function Kpi({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="glass px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="stat-value" style={{ color }}>
        {value}<span className="ml-0.5 text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}

export default function KpiBar() {
  const m = useStore((s) => s.snapshot?.metrics);
  if (!m) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi label="Delivered" value={fmt(m.completedDeliveries)} color="#34d399" />
      <Kpi label="In progress" value={fmt(m.inProgressOrders)} color="#a78bfa" />
      <Kpi label="Pending" value={fmt(m.pendingOrders)} color={m.pendingOrders > 8 ? "#f87171" : "#e5e7eb"} />
      <Kpi label="P50 latency" value={m.p50} unit="s" />
      <Kpi label="Fleet dist" value={`${(m.totalFleetMiles / 1000).toFixed(1)}k`} />
      <Kpi label="Network" value={m.networkHealth} color={healthColor[m.networkHealth]} />
    </div>
  );
}
