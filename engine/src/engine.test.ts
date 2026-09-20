import { describe, expect, it } from "vitest";
import { CityMap } from "./cityMap";
import { SimulationEngine } from "./engine";
import { runComparison, runExperiment, verdict } from "./experiment";
import { findPath } from "./pathfinding";
import { STRATEGIES } from "./types";

describe("city map", () => {
  it("loads the graph", () => {
    const m = new CityMap();
    expect(m.nodes.length).toBe(63);
    expect(m.edges.length).toBe(93);
    expect(m.restaurants().length).toBeGreaterThan(0);
    expect(m.dropoffs().length).toBeGreaterThan(0);
  });
});

describe("pathfinding", () => {
  it("finds a path between two nodes", () => {
    const m = new CityMap();
    const a = m.nodes[0].id, b = m.nodes[40].id;
    const p = findPath(m, a, b);
    expect(p).not.toBeNull();
    expect(p!.nodeIds[0]).toBe(a);
    expect(p!.nodeIds.at(-1)).toBe(b);
    expect(p!.totalDistance).toBeGreaterThan(0);
  });
});

describe("determinism", () => {
  it("same seed → identical run", () => {
    const run = () => {
      const e = new SimulationEngine(new CityMap(), { seed: 7, spawnIncidents: false });
      e.setStrategy("BALANCED");
      for (let t = 0; t < 120; t++) e.step(1);
      return { generated: e.generated, delivered: e.delivered, miles: e.fleetMiles };
    };
    expect(run()).toEqual(run());
  });

  it("experiment results are reproducible", () => {
    expect(runExperiment("BATCH_OPTIMAL", 150, 42)).toEqual(runExperiment("BATCH_OPTIMAL", 150, 42));
  });
});

describe("benchmark sanity", () => {
  it("all strategies deliver orders and batch strategies batch", () => {
    const results = runComparison(200, 42);
    expect(results.length).toBe(STRATEGIES.length);
    for (const r of results) {
      expect(r.totalOrders).toBeGreaterThan(0);
      expect(r.completed).toBeGreaterThan(0);
    }
    const batch = results.filter((r) => r.strategy.startsWith("BATCH"));
    expect(batch.every((r) => r.batchedOrders > 0)).toBe(true);

    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        strategy: r.strategy, completed: r.completed, p50: r.p50, p95: r.p95,
        fleetMi: r.totalFleetMiles, miPerDel: r.milesPerDelivery,
        batch: r.batchedOrders, savings: r.batchSavingsPercent, satis: r.customerSatisfaction,
      }))
    );
    // eslint-disable-next-line no-console
    console.log("VERDICT:", verdict(results)?.headline);
  });
});
