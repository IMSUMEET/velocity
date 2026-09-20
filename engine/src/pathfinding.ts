import type { CityMap } from "./cityMap";

export interface PathResult { nodeIds: string[]; totalCost: number; totalDistance: number; }

/** Binary-heap min-priority queue keyed by numeric priority. */
class MinHeap {
  private a: { id: string; p: number }[] = [];
  get size() { return this.a.length; }
  push(id: string, p: number) {
    this.a.push({ id, p });
    let i = this.a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.a[parent].p <= this.a[i].p) break;
      [this.a[parent], this.a[i]] = [this.a[i], this.a[parent]];
      i = parent;
    }
  }
  pop(): { id: string; p: number } | undefined {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length && last) {
      this.a[0] = last;
      let i = 0;
      const n = this.a.length;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < n && this.a[l].p < this.a[s].p) s = l;
        if (r < n && this.a[r].p < this.a[s].p) s = r;
        if (s === i) break;
        [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
        i = s;
      }
    }
    return top;
  }
}

/**
 * Dijkstra shortest path over the road graph. Costs come from
 * CityMap.effectiveCost, so live incidents that inflate edge weights
 * automatically push routes around congestion.
 */
export function findPath(map: CityMap, start: string, end: string): PathResult | null {
  if (!start || !end) return null;
  if (start === end) return { nodeIds: [start], totalCost: 0, totalDistance: 0 };
  if (!map.node(start) || !map.node(end)) return null;

  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const heap = new MinHeap();
  heap.push(start, 0);

  while (heap.size) {
    const top = heap.pop()!;
    const cur = top.id;
    if (cur === end) break;
    if (top.p > (dist.get(cur) ?? Infinity)) continue;
    for (const adj of map.neighbors(cur)) {
      const nd = (dist.get(cur) ?? Infinity) + map.effectiveCost(adj);
      if (nd < (dist.get(adj.nodeId) ?? Infinity)) {
        dist.set(adj.nodeId, nd);
        prev.set(adj.nodeId, cur);
        heap.push(adj.nodeId, nd);
      }
    }
  }

  if (!prev.has(end)) return null;
  const path: string[] = [];
  let cur: string | undefined = end;
  while (cur) { path.push(cur); cur = prev.get(cur); }
  path.reverse();

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += map.distanceBetween(path[i], path[i + 1]);
  }
  return { nodeIds: path, totalCost: dist.get(end) ?? 0, totalDistance };
}
