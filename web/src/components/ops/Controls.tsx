"use client";

import { STRATEGIES, STRATEGY_META } from "@velocity/engine";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { isBatch, strategyColor } from "@/lib/ui";

export default function Controls() {
  const snap = useStore((s) => s.snapshot);
  if (!snap) return null;
  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="glass space-y-4 p-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Dispatch strategy</p>
        <div className="grid grid-cols-1 gap-1.5">
          {STRATEGIES.map((s) => {
            const active = snap.strategy === s;
            return (
              <button key={s} onClick={() => api.setStrategy(s)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active ? "border-white/25 bg-white/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: strategyColor[s] }} />
                  {STRATEGY_META[s].label}
                </span>
                <span className={`chip !py-0 text-[10px] ${isBatch(s) ? "text-batch" : "text-slate-400"}`}>
                  {isBatch(s) ? "batch" : "greedy"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Speed</p>
        <div className="flex gap-1.5">
          {speeds.map((sp) => (
            <button key={sp} onClick={() => api.setSpeed(sp)}
              className={`btn flex-1 !px-2 ${snap.speed === sp ? "btn-accent" : ""}`}>{sp}×</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => (snap.running ? api.pause() : api.resume())} className="btn flex-1">
          {snap.running ? "⏸ Pause" : "▶ Resume"}
        </button>
        <button onClick={() => api.reset()} className="btn">↺ Reset</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => api.deployDriver("BIKE")} className="btn flex-1 text-xs">+ Bike</button>
        <button onClick={() => api.deployDriver("CAR")} className="btn flex-1 text-xs">+ Car</button>
        <button onClick={() => api.rushDelayed()} className="btn flex-1 text-xs">Rush delayed</button>
      </div>
    </div>
  );
}
