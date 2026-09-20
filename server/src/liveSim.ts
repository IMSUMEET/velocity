import { CityMap, SimulationEngine, type DispatchStrategy, type Snapshot } from "@velocity/engine";

const TICK_MS = 500;

/**
 * Wraps the pure engine with a wall-clock tick loop and a set of snapshot
 * subscribers (WebSocket clients). This is the authoritative live simulation.
 */
export class LiveSim {
  readonly engine: SimulationEngine;
  running = true;
  speed = 1;
  private timer: NodeJS.Timeout | null = null;
  private subscribers = new Set<(s: Snapshot) => void>();

  constructor() {
    this.engine = new SimulationEngine(new CityMap(), {
      drivers: 12,
      orderIntervalTicks: 4,
      spawnIncidents: true,
    });
    this.start();
  }

  private loop = () => {
    if (this.running) {
      this.engine.step(this.speed);
      this.broadcast();
    }
  };

  start() {
    if (this.timer) return;
    this.timer = setInterval(this.loop, TICK_MS);
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.subscribers.add(fn);
    fn(this.snapshot()); // send current state immediately
    return () => this.subscribers.delete(fn);
  }

  private broadcast() {
    const snap = this.snapshot();
    for (const fn of this.subscribers) fn(snap);
  }

  snapshot(): Snapshot {
    return this.engine.snapshot(this.running, this.speed);
  }

  // controls
  pause() { this.running = false; this.broadcast(); }
  resume() { this.running = true; this.broadcast(); }
  setSpeed(s: number) { this.speed = Math.min(4, Math.max(0.25, s)); this.broadcast(); }
  setStrategy(s: DispatchStrategy) { this.engine.setStrategy(s); this.broadcast(); }
  reset() { this.engine.reset(); this.broadcast(); }
}
