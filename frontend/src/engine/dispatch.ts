import type { Driver, Order, DispatchDecision, ScoreBreakdown } from '../types';
import { findPath, estimateETA } from '../engine/pathfinding';
import { ROAD_NODES } from '../data/cityMap';

interface DispatchCandidate {
  driver: Driver;
  score: number;
  reason: string;
  distance: number;
  eta: number;
  pathToPickup: string[];
  scoreBreakdown: ScoreBreakdown;
}

/**
 * Multi-factor dispatch engine with order batching support.
 *
 * Scoring: lower = better match.
 *   distanceScore   = pathCost × 0.35
 *   etaScore        = estimatedETA × 0.25
 *   orderAgeScore   = -(age / 10s) × 0.20  (older orders get priority)
 *   vehicleBonus    = -5 for bikes in congested zones
 *   experienceBonus = -driver.experience × 0.5
 *   batchBonus      = -8 if driver can batch a nearby order
 */
export function runDispatch(
  pendingOrders: Order[],
  availableDrivers: Driver[],
  trafficMultiplier: number
): DispatchDecision[] {
  const decisions: DispatchDecision[] = [];
  const assignedDriverIds = new Set<string>();
  const assignedOrderIds = new Set<string>();

  const sortedOrders = [...pendingOrders].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.createdAt - b.createdAt;
  });

  for (const order of sortedOrders) {
    if (assignedOrderIds.has(order.id)) continue;

    const candidates: DispatchCandidate[] = [];

    for (const driver of availableDrivers) {
      if (driver.status !== 'IDLE') continue;
      if (assignedDriverIds.has(driver.id)) continue;

      const pathResult = findPath(driver.currentNodeId, order.restaurantNodeId);
      if (!pathResult) continue;

      const candidate = scoreDriver(driver, order, pathResult.nodeIds, pathResult.totalCost, trafficMultiplier, sortedOrders, assignedOrderIds);
      candidates.push(candidate);
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];

    assignedDriverIds.add(best.driver.id);
    assignedOrderIds.add(order.id);

    decisions.push({
      id: `dispatch-${Date.now()}-${order.id}`,
      orderId: order.id,
      driverId: best.driver.id,
      driverName: best.driver.name,
      restaurantName: order.restaurantName,
      score: Math.round(best.score * 100) / 100,
      reason: best.reason,
      distance: Math.round(best.distance * 100) / 100,
      eta: Math.round(best.eta),
      timestamp: Date.now(),
      scoreBreakdown: best.scoreBreakdown,
    });
  }

  return decisions;
}

function scoreDriver(
  driver: Driver,
  order: Order,
  pathToPickup: string[],
  pathCost: number,
  trafficMultiplier: number,
  _allPending: Order[],
  _assigned: Set<string>
): DispatchCandidate {
  const pathResult = { nodeIds: pathToPickup, totalCost: pathCost, totalDistance: pathCost };
  const speedMultiplier = driver.vehicleType === 'BIKE' && trafficMultiplier > 1.0
    ? 1.2
    : driver.vehicleType === 'CAR' && trafficMultiplier > 1.0
      ? 0.5
      : 1.0;

  const eta = estimateETA(pathResult, speedMultiplier);
  const distance = pathCost;

  const distanceScore = distance * 0.35;
  const etaScore = eta * 0.25;
  const orderAge = (Date.now() - order.createdAt) / 10000;
  const orderAgeScore = orderAge * 0.20;

  const orderNode = ROAD_NODES.find(n => n.id === order.restaurantNodeId);
  const isCongestedZone = orderNode ? trafficMultiplier > 1.0 : false;
  const vehicleBonus = driver.vehicleType === 'BIKE' && isCongestedZone ? -5 : 0;

  const experienceBonus = -(driver.experience * 0.5);

  // Check for batch opportunity (nearby orders at same/close restaurants)
  let batchBonus = 0;
  const nearbyBatchable = _allPending.filter(o =>
    o.id !== order.id &&
    !_assigned.has(o.id) &&
    o.restaurantNodeId === order.restaurantNodeId
  );
  if (nearbyBatchable.length > 0) {
    batchBonus = -8;
  }

  const finalScore = distanceScore + etaScore - orderAgeScore + vehicleBonus + experienceBonus + batchBonus;

  const breakdown: ScoreBreakdown = {
    distanceScore: Math.round(distanceScore * 100) / 100,
    etaScore: Math.round(etaScore * 100) / 100,
    orderAgeScore: Math.round(orderAgeScore * 100) / 100,
    vehicleBonus,
    experienceBonus: Math.round(experienceBonus * 100) / 100,
    batchBonus,
    total: Math.round(finalScore * 100) / 100,
  };

  const distanceMiles = (distance * 0.1).toFixed(1);
  const etaMinutes = Math.ceil(eta / 60);
  let reason = `${driver.name} → ${order.restaurantName} (${distanceMiles}mi, ~${etaMinutes}min)`;
  if (batchBonus < 0) reason += ' [batch]';
  if (experienceBonus < -2) reason += ' [experienced]';
  if (vehicleBonus < 0) reason += ' [bike+congestion]';

  return { driver, score: finalScore, reason, distance, eta, pathToPickup, scoreBreakdown: breakdown };
}
