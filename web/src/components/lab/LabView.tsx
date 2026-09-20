"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { DispatchStrategy, ExperimentResult } from "@velocity/engine";
import { STRATEGY_META } from "@velocity/engine";
import { api, type CompareResponse } from "@/lib/api";
import { isBatch, strategyColor } from "@/lib/ui";

const chartTip = {
  contentStyle: { background: "#0d1428", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#e5e7eb" },
  labelStyle: { color: "#94a3b8" },
};

function paretoFrontier(results: ExperimentResult[]) {
  // lower P95 and lower fleet distance are both better
  return results
    .filter((r) => !results.some((o) =>
      o !== r && o.p95 <= r.p95 && o.totalFleetMiles <= r.totalFleetMiles &&
      (o.p95 < r.p95 || o.totalFleetMiles < r.totalFleetMiles)))
    .sort((a, b) => a.p95 - b.p95);
}

export default function LabView() {
  const [ticks, setTicks] = useState(240);
  const [seed, setSeed] = useState(42);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await api.compare(ticks, seed)); }
    finally { setLoading(false); }
  }, [ticks, seed]);

  useEffect(() => { run(); /* auto-run once on mount */ }, [run]);

  const results = data?.results ?? [];
  const frontierIds = new Set(paretoFrontier(results).map((r) => r.strategy));
  const scatter = results.map((r) => ({
    x: r.p95, y: Math.round(r.totalFleetMiles / 100) / 10, label: STRATEGY_META[r.strategy].label,
    strategy: r.strategy, color: strategyColor[r.strategy],
  }));
  const frontierLine = paretoFrontier(results).map((r) => ({
    x: r.p95, y: Math.round(r.totalFleetMiles / 100) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Hero question */}
      <section className="glass p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="chip mb-3">Reproducible benchmark · seeded</span>
            <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Which dispatch strategy wins the{" "}
              <span className="text-accent">cost-vs-speed</span> trade-off?
            </h1>
            <p className="mt-3 text-slate-400">
              Every strategy runs on an <span className="text-slate-200">identical, seeded</span> order
              stream across a 63-node city. We measure fleet distance against delivery latency, then
              call the winner — and you can <span className="text-slate-200">watch why</span> in Operations.
            </p>
          </div>

          <div className="glass shrink-0 p-4">
            <div className="flex items-end gap-3">
              <label className="text-xs text-slate-400">
                Ticks
                <input type="number" value={ticks} min={60} max={600} step={20}
                  onChange={(e) => setTicks(Number(e.target.value))}
                  className="mt-1 w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm outline-none focus:border-accent/50" />
              </label>
              <label className="text-xs text-slate-400">
                Seed
                <input type="number" value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  className="mt-1 w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm outline-none focus:border-accent/50" />
              </label>
            </div>
            <button onClick={run} disabled={loading} className="btn btn-accent mt-3 w-full">
              {loading ? "Running all 5 strategies…" : "▶ Run benchmark"}
            </button>
          </div>
        </div>
      </section>

      {/* Verdict */}
      {data?.verdict && (
        <motion.section
          key={data.verdict.headline}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass relative overflow-hidden p-6 shadow-glow-violet"
        >
          <div className="absolute inset-y-0 left-0 w-1.5 bg-batch" />
          <p className="text-xs uppercase tracking-widest text-slate-400">Verdict</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.verdict.headline.split(":")[0]}:{" "}
            <span className="text-batch">{data.verdict.headline.split(":").slice(1).join(":").trim()}</span>
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Batching holds nearby orders for a few ticks and serves them on one multi-stop route —
            trading a small latency increase for a real cut in fleet distance. In sparse demand the
            trade-off flips; run different ticks/seeds to probe it.
          </p>
        </motion.section>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="glass p-5">
          <h3 className="mb-1 font-semibold">Efficiency vs latency</h3>
          <p className="mb-4 text-xs text-slate-400">
            Lower-left is better. Points on the dashed <span className="text-batch">Pareto frontier</span> are non-dominated.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <XAxis type="number" dataKey="x" name="P95 latency" unit="s" domain={["dataMin - 4", "dataMax + 4"]}
                tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#334155"
                label={{ value: "P95 latency (s)", position: "insideBottom", offset: -10, fill: "#94a3b8", fontSize: 12 }} />
              <YAxis type="number" dataKey="y" name="Fleet distance" domain={["dataMin - 3", "dataMax + 3"]}
                tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#334155"
                label={{ value: "Fleet distance (k units)", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 12 }} />
              <ZAxis range={[220, 220]} />
              <Tooltip {...chartTip} cursor={{ strokeDasharray: "3 3", stroke: "#475569" }}
                formatter={(v: number, n: string) => [n === "x" ? `${v}s` : `${v}k`, n === "x" ? "P95" : "Fleet dist"]} />
              {frontierLine.length > 1 && (
                <Scatter data={frontierLine} line={{ stroke: "#a78bfa", strokeDasharray: "5 5", strokeWidth: 1.5 }}
                  shape={() => <g />} legendType="none" isAnimationActive={false} />
              )}
              <Scatter data={scatter} isAnimationActive={false}>
                {scatter.map((p) => (
                  <Cell key={p.strategy} fill={p.color}
                    stroke={frontierIds.has(p.strategy as DispatchStrategy) ? "#fff" : "none"} strokeWidth={1.5} />
                ))}
                <LabelList dataKey="label" position="top" style={{ fill: "#cbd5e1", fontSize: 11 }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </section>

        <section className="glass p-5">
          <h3 className="mb-1 font-semibold">Total fleet distance</h3>
          <p className="mb-4 text-xs text-slate-400">Lower is cheaper to operate.</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={results.map((r) => ({ name: STRATEGY_META[r.strategy].label, v: Math.round(r.totalFleetMiles / 100) / 10, strategy: r.strategy }))}
              layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="name" width={104} tick={{ fill: "#cbd5e1", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip {...chartTip} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: number) => [`${v}k units`, "Fleet dist"]} />
              <Bar dataKey="v" radius={[0, 8, 8, 0]} barSize={18} isAnimationActive={false}>
                {results.map((r) => (
                  <Cell key={r.strategy} fill={strategyColor[r.strategy]} />
                ))}
                <LabelList dataKey="v" position="right" formatter={(v: number) => `${v}k`} style={{ fill: "#94a3b8", fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Results table */}
      <section className="glass overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h3 className="font-semibold">Results — {ticks} ticks · seed {seed}</h3>
          <div className="flex gap-2">
            <a href={api.csvUrl(ticks, seed)} className="btn text-xs" download>Export CSV</a>
            <a href={api.latexUrl(ticks, seed)} className="btn text-xs" target="_blank" rel="noreferrer">Export LaTeX</a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="[&>th]:px-4 [&>th]:py-2.5">
                <th>Strategy</th><th>Completed</th><th>P50 (s)</th><th>P95 (s)</th>
                <th>Fleet dist</th><th>dist/del</th><th>Batched</th><th>Savings</th><th>Satisf.</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const best = data?.verdict?.best === r.strategy;
                return (
                  <tr key={r.strategy} className={`border-t border-white/5 [&>td]:px-4 [&>td]:py-2.5 ${best ? "bg-batch/10" : ""}`}>
                    <td className="font-medium">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: strategyColor[r.strategy] }} />
                      {STRATEGY_META[r.strategy].label}
                      {best && <span className="ml-2 rounded bg-batch/20 px-1.5 py-0.5 text-[10px] font-semibold text-batch">WINNER</span>}
                      <span className={`ml-2 chip !py-0 text-[10px] ${isBatch(r.strategy) ? "text-batch" : "text-slate-400"}`}>{isBatch(r.strategy) ? "batch" : "greedy"}</span>
                    </td>
                    <td>{r.completed}</td><td>{r.p50}</td><td>{r.p95}</td>
                    <td>{(r.totalFleetMiles / 1000).toFixed(1)}k</td>
                    <td>{r.milesPerDelivery.toFixed(0)}</td>
                    <td>{r.batchedOrders}</td>
                    <td>{r.batchSavingsPercent ? `${r.batchSavingsPercent}%` : "—"}</td>
                    <td>{r.customerSatisfaction}</td>
                  </tr>
                );
              })}
              {!results.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Run the benchmark to see results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
