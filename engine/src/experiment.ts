import { CityMap } from "./cityMap";
import { SimulationEngine } from "./engine";
import { SIM, round1, round2 } from "./constants";
import { STRATEGIES, STRATEGY_META } from "./types";
import type { DispatchStrategy, ExperimentResult } from "./types";

/**
 * Dense experiment scenario: enough fleet + arrival rate that spatial batching
 * has real opportunities to form clusters (matches the paper's 18-driver,
 * high-demand regime). In sparse regimes batching cannot help.
 */
export const EXPERIMENT_SCENARIO = { drivers: 18, orderIntervalTicks: 2 } as const;

/**
 * Runs a single headless, seeded simulation for one strategy. Incidents are
 * disabled so every strategy sees the *identical* order-arrival sequence and
 * differences are attributable to the dispatch policy alone.
 */
export function runExperiment(
  strategy: DispatchStrategy,
  durationTicks = 240,
  seed = 42
): ExperimentResult {
  const engine = new SimulationEngine(new CityMap(), {
    seed, spawnIncidents: false,
    drivers: EXPERIMENT_SCENARIO.drivers,
    orderIntervalTicks: EXPERIMENT_SCENARIO.orderIntervalTicks,
  });
  engine.setStrategy(strategy);
  for (let t = 0; t < durationTicks; t++) engine.step(1);

  const durations = engine.deliveryDurationTicks().sort((a, b) => a - b);
  const pct = (p: number) =>
    durations.length ? durations[Math.max(0, Math.floor(durations.length * p) - 1)] * SIM.SECONDS_PER_TICK : 0;
  const avg = durations.length
    ? (durations.reduce((s, v) => s + v, 0) / durations.length) * SIM.SECONDS_PER_TICK
    : 0;

  const total = engine.generated;
  const completed = engine.delivered;
  const delayed = engine.orderList().filter((o) => o.delayed).length;
  const drivers = engine.driverList();
  const activeUtil = drivers.filter((d) => d.status !== "IDLE" && d.status !== "OFFLINE" && d.status !== "ON_BREAK").length;
  const revenue = engine.orderList().filter((o) => o.status === "DELIVERED").reduce((s, o) => s + o.estimatedValue, 0);

  return {
    strategy, durationTicks, seed,
    totalOrders: total,
    completed,
    delayed,
    completionRate: total ? round1((completed / total) * 100) : 0,
    p50: round1(pct(0.5)), p95: round1(pct(0.95)), p99: round1(pct(0.99)), avgDeliverySec: round1(avg),
    totalFleetMiles: round1(engine.fleetMiles),
    milesPerDelivery: completed ? round2(engine.fleetMiles / completed) : 0,
    driverUtilization: drivers.length ? round1((activeUtil / drivers.length) * 100) : 0,
    batchedOrders: engine.batched,
    avgBatchSize: engine.batchDispatchCount ? round1(engine.batched / engine.batchDispatchCount) : 0,
    holdTimeAvgSec: engine.holdSampleCount ? round1((engine.holdTicksTotal / engine.holdSampleCount) * SIM.SECONDS_PER_TICK) : 0,
    batchSavingsPercent: round1(engine.avgBatchSavings),
    customerSatisfaction: round1(Math.max(0, 100 - delayed * 5)),
    revenue: round2(revenue),
  };
}

export function runComparison(durationTicks = 240, seed = 42): ExperimentResult[] {
  return STRATEGIES.map((s) => runExperiment(s, durationTicks, seed));
}

export function exportCsv(results: ExperimentResult[]): string {
  const cols: (keyof ExperimentResult)[] = [
    "strategy", "totalOrders", "completed", "completionRate", "p50", "p95", "p99",
    "avgDeliverySec", "totalFleetMiles", "milesPerDelivery", "driverUtilization",
    "batchedOrders", "avgBatchSize", "holdTimeAvgSec", "batchSavingsPercent",
    "customerSatisfaction", "revenue",
  ];
  const head = cols.join(",");
  const rows = results.map((r) => cols.map((c) => r[c]).join(","));
  return [head, ...rows].join("\n");
}

export function exportLatex(results: ExperimentResult[]): string {
  const lines = [
    "\\begin{table}[htbp]", "\\centering",
    "\\caption{Dispatch Strategy Comparison: Simulation Results}",
    "\\label{tab:strategy-results}",
    "\\begin{tabular}{lrrrrrr}", "\\hline",
    "\\textbf{Strategy} & \\textbf{Completed} & \\textbf{P50 (s)} & \\textbf{P95 (s)} & \\textbf{Fleet mi} & \\textbf{mi/del} & \\textbf{Satisf.} \\\\",
    "\\hline",
  ];
  for (const r of results) {
    lines.push(
      `${STRATEGY_META[r.strategy].label} & ${r.completed} & ${r.p50.toFixed(1)} & ${r.p95.toFixed(1)} & ${r.totalFleetMiles.toFixed(1)} & ${r.milesPerDelivery.toFixed(2)} & ${r.customerSatisfaction.toFixed(1)} \\\\`
    );
  }
  lines.push("\\hline", "\\end{tabular}", "\\end{table}");
  return lines.join("\n");
}

/** Compact "verdict" comparing the best batch strategy to the Balanced greedy baseline. */
export function verdict(results: ExperimentResult[]): {
  best: DispatchStrategy; milesSavedPct: number; p95DeltaSec: number; headline: string;
} | null {
  const baseline = results.find((r) => r.strategy === "BALANCED");
  const batch = results.filter((r) => r.strategy.startsWith("BATCH"));
  if (!baseline || !batch.length) return null;
  const best = batch.reduce((a, b) => (b.totalFleetMiles < a.totalFleetMiles ? b : a));
  const milesSavedPct = baseline.totalFleetMiles
    ? round1((1 - best.totalFleetMiles / baseline.totalFleetMiles) * 100) : 0;
  const p95DeltaSec = round1(best.p95 - baseline.p95);
  const headline = `${STRATEGY_META[best.strategy].label}: ${milesSavedPct >= 0 ? "−" : "+"}${Math.abs(milesSavedPct)}% fleet miles for ${p95DeltaSec >= 0 ? "+" : ""}${p95DeltaSec}s P95 vs Balanced`;
  return { best: best.strategy, milesSavedPct, p95DeltaSec, headline };
}
