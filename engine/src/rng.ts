/**
 * Deterministic PRNG (mulberry32). A single instance drives EVERY random
 * decision in the engine — order generation, restaurant/customer selection,
 * prep times, driver init, incidents — so a fixed seed reproduces an identical
 * run bit-for-bit. (The original Java version used ThreadLocalRandom for order
 * generation, which quietly broke the "seeded experiment" guarantee.)
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid a zero state; mix the seed a little.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** integer in [min, max) */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  /** float in [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)];
  }
}
