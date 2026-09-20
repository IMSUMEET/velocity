/**
 * Headless benchmark runner. Prints a table + verdict and (optionally) writes
 * CSV / LaTeX / JSON artifacts. Used to populate PAPER.md with real numbers.
 *
 *   npm run experiment -w server -- --ticks 240 --seed 42 --out ../docs
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { exportCsv, exportLatex, runComparison, STRATEGY_META, verdict } from "@velocity/engine";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const ticks = Number(opt("ticks", "240"));
const seed = Number(opt("seed", "42"));
const out = opt("out", "");

const results = runComparison(ticks, seed);
const v = verdict(results);

console.log(`\nVeloCity benchmark — ${ticks} ticks, seed ${seed}\n`);
console.table(
  results.map((r) => ({
    Strategy: STRATEGY_META[r.strategy].label,
    Completed: r.completed,
    "P50 (s)": r.p50,
    "P95 (s)": r.p95,
    "Fleet dist": r.totalFleetMiles,
    "dist/del": r.milesPerDelivery,
    "Batch%": r.totalOrders ? Math.round((r.batchedOrders / r.totalOrders) * 100) : 0,
    Satisf: r.customerSatisfaction,
  }))
);
console.log(`\nVERDICT: ${v?.headline}\n`);

if (out) {
  const dir = resolve(process.cwd(), out);
  writeFileSync(resolve(dir, "benchmark.json"), JSON.stringify({ ticks, seed, results, verdict: v }, null, 2));
  writeFileSync(resolve(dir, "benchmark.csv"), exportCsv(results));
  writeFileSync(resolve(dir, "benchmark.tex"), exportLatex(results));
  console.log(`Wrote benchmark.json / .csv / .tex to ${dir}`);
}
