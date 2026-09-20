import raw from "./data/city-map.json";
import type { CityMapData, MapBuilding, MapEdge, MapNode, MapZone } from "./types";

export interface Adjacency { nodeId: string; edgeId: string; cost: number; }

/**
 * Loads the shared road graph and exposes lookups + adjacency used by
 * pathfinding and the engine. Edge weights can be inflated at runtime by the
 * incident engine to force reroutes.
 */
export class CityMap {
  readonly nodes: MapNode[];
  readonly edges: MapEdge[];
  readonly buildings: MapBuilding[];
  readonly zones: MapZone[];

  private nodeById = new Map<string, MapNode>();
  private edgeById = new Map<string, MapEdge>();
  private adjacency = new Map<string, Adjacency[]>();
  private multiplier = new Map<string, number>();

  constructor(data: CityMapData = raw as CityMapData) {
    this.nodes = data.nodes;
    this.edges = data.edges;
    this.buildings = data.buildings;
    this.zones = data.zones;
    for (const n of this.nodes) {
      this.nodeById.set(n.id, n);
      this.adjacency.set(n.id, []);
    }
    for (const e of this.edges) {
      this.edgeById.set(e.id, e);
      const base = (e.distance * (1 + e.congestion)) / Math.max(e.speedLimit, 1);
      this.adjacency.get(e.from)?.push({ nodeId: e.to, edgeId: e.id, cost: base });
      this.adjacency.get(e.to)?.push({ nodeId: e.from, edgeId: e.id, cost: base });
    }
  }

  node(id: string): MapNode | undefined { return this.nodeById.get(id); }
  edge(id: string): MapEdge | undefined { return this.edgeById.get(id); }
  neighbors(id: string): Adjacency[] { return this.adjacency.get(id) ?? []; }

  effectiveCost(a: Adjacency): number {
    return a.cost * (this.multiplier.get(a.edgeId) ?? 1);
  }
  setEdgeMultiplier(edgeId: string, m: number) { this.multiplier.set(edgeId, m); }
  clearEdgeMultiplier(edgeId: string) { this.multiplier.delete(edgeId); }

  distanceBetween(from: string, to: string): number {
    const a = this.nodeById.get(from);
    const b = this.nodeById.get(to);
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  restaurants(): MapBuilding[] { return this.buildings.filter((b) => b.type === "restaurant"); }
  dropoffs(): MapBuilding[] {
    return this.buildings.filter(
      (b) => b.type === "house" || b.type === "apartment" || b.type === "office"
    );
  }
  zoneForNode(id: string): string { return this.nodeById.get(id)?.zone ?? "unknown"; }
}

export const cityMapData = raw as CityMapData;
