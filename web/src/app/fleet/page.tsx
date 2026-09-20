"use client";

import { STRATEGY_META } from "@velocity/engine";
import { useStore } from "@/lib/store";
import { moodColor, statusLabel, strategyColor } from "@/lib/ui";

export default function FleetPage() {
  const snap = useStore((s) => s.snapshot);
  if (!snap) return <p className="text-ink-faint">Connecting to the live simulation…</p>;
  const { drivers, orders, dispatch } = snap;
  const activeOrders = orders.filter((o) => o.status !== "DELIVERED");

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold text-ink">Fleet ({drivers.length})</div>
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr className="[&>th]:px-4 [&>th]:py-2"><th>Driver</th><th>Vehicle</th><th>Status</th><th>Deliv.</th><th>Fatigue</th></tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-t border-line [&>td]:px-4 [&>td]:py-2">
                  <td className="font-medium text-ink">{d.name}</td>
                  <td>{d.vehicleType === "CAR" ? "🚗" : "🚲"}</td>
                  <td className="text-ink-soft">{statusLabel[d.status] ?? d.status}</td>
                  <td className="text-ink-soft">{d.totalDeliveries}</td>
                  <td>
                    <div className="h-1.5 w-16 rounded-full bg-inset">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.fatigue)}%`, background: d.fatigue > 60 ? "#dc2626" : "#059669" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold text-ink">Active orders ({activeOrders.length})</div>
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr className="[&>th]:px-4 [&>th]:py-2"><th>Order</th><th>Route</th><th>Status</th><th>Mood</th></tr>
            </thead>
            <tbody>
              {activeOrders.map((o) => (
                <tr key={o.id} className="border-t border-line [&>td]:px-4 [&>td]:py-2">
                  <td className="font-mono text-xs text-ink-faint">{o.id}{o.batchId && <span className="ml-1 text-batch">⧉</span>}</td>
                  <td className="text-ink-soft">{o.restaurantName} <span className="text-ink-faint">→</span> {o.customerName}</td>
                  <td className="text-ink-soft">{statusLabel[o.status] ?? o.status}</td>
                  <td><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: moodColor[o.mood] }} /></td>
                </tr>
              ))}
              {!activeOrders.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-faint">No active orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden xl:col-span-2">
        <div className="border-b border-line px-5 py-3 font-semibold text-ink">Recent dispatch decisions</div>
        <div className="max-h-72 space-y-1.5 overflow-y-auto p-4">
          {dispatch.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: strategyColor[a.strategy] }} />
              <span className="w-10 font-mono text-ink-faint">t{a.tick}</span>
              <span className="chip !py-0 text-[10px]">{STRATEGY_META[a.strategy].label}</span>
              <span className="text-ink-soft">{a.reason}</span>
            </div>
          ))}
          {!dispatch.length && <p className="text-xs text-ink-faint">No dispatch decisions yet.</p>}
        </div>
      </section>
    </div>
  );
}
