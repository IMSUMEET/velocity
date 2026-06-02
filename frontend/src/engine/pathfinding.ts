import { ROAD_ADJACENCY, ROAD_NODES, getNodeById } from '../data/cityMap';
import type { RoadNode } from '../data/cityMap';

export interface PathResult {
  nodeIds: string[];
  totalCost: number;
  totalDistance: number;
}

class MinHeap {
  private data: { node: string; priority: number }[] = [];

  push(node: string, priority: number) {
    this.data.push({ node, priority });
    this._bubbleUp(this.data.length - 1);
  }

  pop(): { node: string; priority: number } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.data[i].priority >= this.data[parent].priority) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private _sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].priority < this.data[smallest].priority)
        smallest = left;
      if (right < n && this.data[right].priority < this.data[smallest].priority)
        smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

export function findPath(startNodeId: string, endNodeId: string): PathResult | null {
  if (startNodeId === endNodeId) {
    return { nodeIds: [startNodeId], totalCost: 0, totalDistance: 0 };
  }

  if (!ROAD_ADJACENCY.has(startNodeId) || !ROAD_ADJACENCY.has(endNodeId)) {
    return null;
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const heap = new MinHeap();

  dist.set(startNodeId, 0);
  heap.push(startNodeId, 0);

  while (heap.size > 0) {
    const { node: current, priority } = heap.pop()!;

    if (current === endNodeId) break;

    if (priority > (dist.get(current) ?? Infinity)) continue;

    const neighbors = ROAD_ADJACENCY.get(current) ?? [];
    for (const { nodeId, cost } of neighbors) {
      const newDist = (dist.get(current) ?? Infinity) + cost;
      if (newDist < (dist.get(nodeId) ?? Infinity)) {
        dist.set(nodeId, newDist);
        prev.set(nodeId, current);
        heap.push(nodeId, newDist);
      }
    }
  }

  if (!prev.has(endNodeId) && startNodeId !== endNodeId) {
    return null;
  }

  const path: string[] = [];
  let current: string | undefined = endNodeId;
  while (current) {
    path.unshift(current);
    current = prev.get(current);
  }

  const totalCost = dist.get(endNodeId) ?? 0;

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = getNodeById(path[i]);
    const b = getNodeById(path[i + 1]);
    if (a && b) {
      totalDistance += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }
  }

  return { nodeIds: path, totalCost, totalDistance };
}

export function getPathCoordinates(nodeIds: string[]): { x: number; y: number }[] {
  return nodeIds
    .map(id => getNodeById(id))
    .filter((n): n is RoadNode => n !== undefined)
    .map(n => ({ x: n.x, y: n.y }));
}

export function findNearestNode(x: number, y: number): RoadNode | null {
  let nearest: RoadNode | null = null;
  let minDist = Infinity;

  for (const node of ROAD_NODES) {
    const d = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    if (d < minDist) {
      minDist = d;
      nearest = node;
    }
  }

  return nearest;
}

export function estimateETA(pathResult: PathResult, speedMultiplier: number = 1): number {
  return pathResult.totalCost / Math.max(speedMultiplier, 0.1);
}
