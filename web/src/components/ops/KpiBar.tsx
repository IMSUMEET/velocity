"use client";

import { useStore } from "@/lib/store";
import { fmt, healthColor } from "@/lib/ui";

function Kpi({ label, value, unit, color, icon }: { label: string; value: string | number; unit?: string; color?: string; icon: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        <span>{icon}</span>{label}
      </p>
      <p className="stat-value mt-1" style={{ color: color ?? "#1b2238" }}>
        {value}<span className="ml-0.5 text-sm font-normal text-ink-faint">{unit}</span>
      </p>
    </div>
  );
}

export default function KpiBar() {
  const m = useStore((s) => s.snapshot?.metrics);
  if (!m) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi icon="✅" label="Delivered" value={fmt(m.completedDeliveries)} color="#059669" />
      <Kpi icon="🛵" label="In progress" value={fmt(m.inProgressOrders)} color="#7c3aed" />
      <Kpi icon="⏳" label="Pending" value={fmt(m.pendingOrders)} color={m.pendingOrders > 8 ? "#dc2626" : "#1b2238"} />
      <Kpi icon="⚡" label="P50 latency" value={m.p50} unit="s" />
      <Kpi icon="🛣️" label="Fleet dist" value={`${(m.totalFleetMiles / 1000).toFixed(1)}k`} />
      <Kpi icon="📶" label="Network" value={m.networkHealth} color={healthColor[m.networkHealth]} />
    </div>
  );
}
