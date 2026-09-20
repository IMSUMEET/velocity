import type { DispatchStrategy, ExperimentResult } from "@velocity/engine";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export interface StrategyInfo { id: DispatchStrategy; label: string; kind: "greedy" | "batch"; blurb: string; }
export interface Verdict { best: DispatchStrategy; milesSavedPct: number; p95DeltaSec: number; headline: string; }
export interface CompareResponse { results: ExperimentResult[]; verdict: Verdict | null; ticks: number; seed: number; }

export const api = {
  strategies: () => fetch("/api/dispatch/strategies").then((r) => j<StrategyInfo[]>(r)),
  setStrategy: (strategy: DispatchStrategy) =>
    fetch("/api/dispatch/strategy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strategy }) }),
  pause: () => fetch("/api/simulation/pause", { method: "POST" }),
  resume: () => fetch("/api/simulation/resume", { method: "POST" }),
  reset: () => fetch("/api/simulation/reset", { method: "POST" }),
  setSpeed: (speed: number) =>
    fetch("/api/simulation/speed", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speed }) }),
  deployDriver: (type: "CAR" | "BIKE") =>
    fetch("/api/drivers/deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) }),
  cancelOrder: (id: string) => fetch(`/api/orders/${id}/cancel`, { method: "POST" }),
  boostOrder: (id: string) => fetch(`/api/orders/${id}/priority`, { method: "POST" }),
  mitigateIncident: (id: string) => fetch(`/api/incidents/${id}/mitigate`, { method: "POST" }),
  resolveIncident: (id: string) => fetch(`/api/incidents/${id}/resolve`, { method: "POST" }),
  rushDelayed: () => fetch("/api/admin/rush-delayed", { method: "POST" }),
  compare: (durationTicks: number, seed: number) =>
    fetch("/api/experiments/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationTicks, seed }) }).then((r) => j<CompareResponse>(r)),
  csvUrl: (ticks: number, seed: number) => `/api/experiments/export/csv?ticks=${ticks}&seed=${seed}`,
  latexUrl: (ticks: number, seed: number) => `/api/experiments/export/latex?ticks=${ticks}&seed=${seed}`,
};
