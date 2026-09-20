import type { CityMap } from "./cityMap";
import { findPath } from "./pathfinding";
import { SIM, round2 } from "./constants";
import type {
  BatchPlan, DispatchAttempt, DispatchCandidate, DispatchStrategy, Driver, Order,
} from "./types";

let dspSeq = 0;
let batchSeq = 0;
const nextDspId = () => `dsp-${(++dspSeq).toString(36)}`;
const nextBatchId = () => `batch-${(++batchSeq).toString(36)}`;

// ------------------------------------------------------------- greedy scoring
function scoreCandidate(
  map: CityMap, driver: Driver, order: Order, totalCost: number,
  strategy: DispatchStrategy, nowTick: number
): DispatchCandidate {
  const distance = totalCost;
  const vehicleFactor = driver.vehicleType === "BIKE" ? 0.85 : 1.0;
  const eta = distance * vehicleFactor;
  const ageMin = ((nowTick - order.createdTick) * SIM.SECONDS_PER_TICK) / 60;

  const distanceScore = distance * 0.35;
  const etaScore = eta * 0.25;
  const orderAgeScore = ageMin * 0.2;
  const experienceBonus = -(driver.experience * 0.5);
  const vehicleBonus = driver.vehicleType === "BIKE" ? -2.0 : 0.0;

  let total: number;
  switch (strategy) {
    case "FASTEST_ETA": total = eta * 0.8 + distanceScore * 0.2 - orderAgeScore; break;
    case "LOWEST_COST": total = distance * 0.7 + etaScore * 0.3 - orderAgeScore; break;
    default: total = distanceScore + etaScore - orderAgeScore + experienceBonus + vehicleBonus;
  }

  return {
    driverId: driver.id, driverName: driver.name, vehicleType: driver.vehicleType,
    score: round2(total), distance: round2(distance), eta: round2(eta),
    breakdown: {
      distance: round2(distanceScore), eta: round2(etaScore), orderAge: round2(orderAgeScore),
      experience: round2(experienceBonus), vehicle: round2(vehicleBonus), total: round2(total),
    },
    selected: false, rejectReason: null,
  };
}

export function evaluate(
  map: CityMap, order: Order, idle: Driver[], strategy: DispatchStrategy, nowTick: number
): DispatchAttempt {
  const candidates: DispatchCandidate[] = [];
  for (const d of idle) {
    const path = findPath(map, d.currentNodeId, order.restaurantNodeId);
    if (!path) continue;
    candidates.push(scoreCandidate(map, d, order, path.totalCost, strategy, nowTick));
  }
  candidates.sort((a, b) => a.score - b.score);

  const attempt: DispatchAttempt = {
    id: nextDspId(), orderId: order.id, restaurantName: order.restaurantName,
    strategy, tick: nowTick, matched: false, selectedDriverId: null, selectedDriverName: null,
    score: 0, distance: 0, eta: 0, candidatesEvaluated: candidates.length,
    candidates, reason: "", batchId: null, batchSize: 0, batchSavingsPercent: 0,
  };

  if (candidates.length) {
    const best = candidates[0];
    best.selected = true;
    for (let i = 1; i < candidates.length; i++) {
      candidates[i].rejectReason = `higher score than ${best.driverName}`;
    }
    attempt.matched = true;
    attempt.selectedDriverId = best.driverId;
    attempt.selectedDriverName = best.driverName;
    attempt.score = best.score;
    attempt.distance = best.distance;
    attempt.eta = best.eta;
    attempt.reason = `${best.driverName} [${strategy}] picked for ${order.restaurantName} (cost ${best.distance}, eta ${best.eta})`;
  }
  return attempt;
}

// -------------------------------------------------------------------- batch
function clusterOrders(map: CityMap, orders: Order[]): Order[][] {
  const clusters: Order[][] = [];
  const used = new Array(orders.length).fill(false);
  for (let i = 0; i < orders.length; i++) {
    if (used[i]) continue;
    const cluster = [orders[i]];
    used[i] = true;
    for (let j = i + 1; j < orders.length && cluster.length < SIM.MAX_BATCH_SIZE; j++) {
      if (used[j]) continue;
      const dist = map.distanceBetween(orders[i].restaurantNodeId, orders[j].restaurantNodeId);
      if (dist <= SIM.BATCH_PROXIMITY_THRESHOLD) { cluster.push(orders[j]); used[j] = true; }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function selectDriverForCluster(map: CityMap, cluster: Order[], idle: Driver[], usedIds: Set<string>): Driver | null {
  const cx = cluster.reduce((s, o) => s + (map.node(o.restaurantNodeId)?.x ?? 0), 0) / cluster.length;
  const cy = cluster.reduce((s, o) => s + (map.node(o.restaurantNodeId)?.y ?? 0), 0) / cluster.length;
  let best: Driver | null = null;
  let bestDist = Infinity;
  for (const d of idle) {
    if (usedIds.has(d.id)) continue;
    const n = map.node(d.currentNodeId);
    if (!n) continue;
    const dist = Math.hypot(n.x - cx, n.y - cy);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

function nearestNeighbourOrder(map: CityMap, start: string, orders: Order[]): Order[] {
  const remaining = [...orders];
  const sorted: Order[] = [];
  let cursor = start;
  while (remaining.length) {
    let best = remaining[0], bd = Infinity;
    for (const o of remaining) {
      const d = map.distanceBetween(cursor, o.restaurantNodeId);
      if (d < bd) { bd = d; best = o; }
    }
    sorted.push(best);
    remaining.splice(remaining.indexOf(best), 1);
    cursor = best.restaurantNodeId;
  }
  return sorted;
}

function tspInsertionOrder(map: CityMap, start: string, orders: Order[]): Order[] {
  if (orders.length <= 2) return nearestNeighbourOrder(map, start, orders);
  const remaining = [...orders];
  let first = remaining[0], fd = Infinity;
  for (const o of remaining) {
    const d = map.distanceBetween(start, o.restaurantNodeId);
    if (d < fd) { fd = d; first = o; }
  }
  const tour = [first];
  remaining.splice(remaining.indexOf(first), 1);
  while (remaining.length) {
    let bestInc = Infinity, bestPos = 0, bestOrder: Order | null = null;
    for (const c of remaining) {
      for (let i = 0; i <= tour.length; i++) {
        const prev = i === 0 ? start : tour[i - 1].restaurantNodeId;
        const next = i === tour.length ? null : tour[i].restaurantNodeId;
        const cost = map.distanceBetween(prev, c.restaurantNodeId)
          + (next ? map.distanceBetween(c.restaurantNodeId, next) : 0)
          - (next ? map.distanceBetween(prev, next) : 0);
        if (cost < bestInc) { bestInc = cost; bestPos = i; bestOrder = c; }
      }
    }
    if (bestOrder) { tour.splice(bestPos, 0, bestOrder); remaining.splice(remaining.indexOf(bestOrder), 1); }
  }
  return tour;
}

function buildBatchPlan(
  map: CityMap, driver: Driver, orders: Order[], strategy: DispatchStrategy, nowTick: number
): BatchPlan | null {
  const ordered = strategy === "BATCH_OPTIMAL"
    ? tspInsertionOrder(map, driver.currentNodeId, orders)
    : nearestNeighbourOrder(map, driver.currentNodeId, orders);

  const routeNodes: string[] = [];
  let totalDist = 0;
  let cursor = driver.currentNodeId;
  const dropNodes: string[] = [];

  for (const o of ordered) {
    const p = findPath(map, cursor, o.restaurantNodeId);
    if (!p) return null;
    let seg = p.nodeIds;
    if (routeNodes.length) seg = seg.slice(1);
    routeNodes.push(...seg);
    totalDist += p.totalCost;
    cursor = o.restaurantNodeId;
    dropNodes.push(o.customerNodeId);
  }
  for (const drop of dropNodes) {
    const p = findPath(map, cursor, drop);
    if (!p) return null;
    let seg = p.nodeIds;
    if (routeNodes.length) seg = seg.slice(1);
    routeNodes.push(...seg);
    totalDist += p.totalCost;
    cursor = drop;
  }

  let greedyBaseline = 0;
  for (const o of ordered) {
    const p1 = findPath(map, driver.currentNodeId, o.restaurantNodeId);
    const p2 = p1 ? findPath(map, o.restaurantNodeId, o.customerNodeId) : null;
    if (p1 && p2) greedyBaseline += p1.totalCost + p2.totalCost;
  }
  const savings = greedyBaseline > 0 ? (1 - totalDist / greedyBaseline) * 100 : 0;
  const avgHold = ordered.reduce((s, o) => s + (o.holdStartTick != null ? nowTick - o.holdStartTick : 0), 0) / ordered.length;

  return {
    id: nextBatchId(),
    driverId: driver.id,
    orderIds: ordered.map((o) => o.id),
    routeNodes,
    totalDistance: round2(totalDist),
    estimatedTime: round2(totalDist * (driver.vehicleType === "BIKE" ? 0.85 : 1.0)),
    holdTicks: Math.round(avgHold),
    greedyBaselineDistance: round2(greedyBaseline),
    savingsPercent: round2(Math.max(0, savings)),
  };
}

export function evaluateBatch(
  map: CityMap, held: Order[], idle: Driver[], strategy: DispatchStrategy, nowTick: number
): BatchPlan[] {
  if (!idle.length || !held.length) return [];
  const clusters = clusterOrders(map, held);
  const plans: BatchPlan[] = [];
  const usedDrivers = new Set<string>();
  for (const cluster of clusters) {
    if (!cluster.length) continue;
    const driver = selectDriverForCluster(map, cluster, idle, usedDrivers);
    if (!driver) continue;
    const plan = buildBatchPlan(map, driver, cluster, strategy, nowTick);
    if (!plan) continue;
    plans.push(plan);
    usedDrivers.add(driver.id);
  }
  return plans;
}
