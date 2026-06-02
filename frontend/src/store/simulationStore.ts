import { create } from 'zustand';
import type { Driver, Order, DispatchDecision, Metrics, ZoneHeat, Incident, IncidentLogEntry, VehicleType, DriverStatus, OrderStatus, CustomerMood, DeliveryRecord, PercentileMetrics, NetworkHealth } from '../types';
import { findPath } from '../engine/pathfinding';
import { BUILDINGS, ROAD_NODES, ROAD_EDGES, CITY_ZONES } from '../data/cityMap';
import { runDispatch } from '../engine/dispatch';

// --- Constants ---
const SIM_SPEED_MULT = 10; // 1 real second = 10 sim seconds
const MOVE_SPEED_FACTOR = 0.005; // Much slower than before (was 0.04)
const BASE_ORDER_INTERVAL = 180; // ticks between order spawns (~3s real)
const INCIDENT_CHECK_INTERVAL = 360; // check for new incidents every ~6s
const COOK_TIME_BASE = 200; // base cook time in ticks (~3.3s real = 33s sim)
const COOK_TIME_VARIANCE = 120;
const FATIGUE_PER_DELIVERY = 15;
const FATIGUE_BREAK_THRESHOLD = 85;
const BREAK_DURATION = 600; // ticks (~10s real = 100s sim)
const DELAYED_THRESHOLD_MS = 60000; // 60s real = 10 sim minutes

const DRIVER_NAMES = [
  'Maya Chen', 'Kai Rivera', 'Jordan Lee', 'Sam Patel',
  'Riley Kim', 'Alex Nguyen', 'Morgan Cruz', 'Taylor Brooks',
  'Quinn Davis', 'Drew Martin', 'Avery Santos', 'Blake Wilson',
  'Casey Thompson', 'Jamie Reyes', 'Logan Park', 'Peyton Hall',
];
const CUSTOMER_NAMES = [
  'Emma S.', 'Liam T.', 'Olivia R.', 'Noah B.', 'Ava M.', 'Ethan W.',
  'Sophia K.', 'Mason J.', 'Isabella F.', 'William D.', 'Mia L.', 'James H.',
  'Harper G.', 'Lucas N.', 'Ella P.', 'Jack C.',
];

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function generateId(): string { return Math.random().toString(36).substring(2, 10); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function getEdgeBetween(fromId: string, toId: string) {
  return ROAD_EDGES.find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId));
}
function getRestaurantBuildings() { return BUILDINGS.filter(b => b.type === 'restaurant'); }
function getDropoffBuildings() { return BUILDINGS.filter(b => b.type === 'house' || b.type === 'apartment' || b.type === 'office'); }
function getZoneForNode(nodeId: string): string { return ROAD_NODES.find(n => n.id === nodeId)?.zone ?? 'unknown'; }

function computePercentiles(records: DeliveryRecord[]): PercentileMetrics {
  if (records.length === 0) return { p50: 0, p95: 0, p99: 0, count: 0 };
  const sorted = [...records].map(r => r.durationMs / 1000).sort((a, b) => a - b);
  const p = (pct: number) => { const idx = Math.ceil((pct / 100) * sorted.length) - 1; return Math.round(sorted[Math.max(0, idx)] * 10) / 10; };
  return { p50: p(50), p95: p(95), p99: p(99), count: sorted.length };
}

function createDriver(index: number, type: VehicleType): Driver {
  const nodeIds = ROAD_NODES.map(n => n.id);
  const baseSpeed = type === 'CAR' ? 1.0 : 0.8;
  return {
    id: `driver-${generateId()}`, name: DRIVER_NAMES[index % DRIVER_NAMES.length],
    vehicleType: type, status: 'IDLE' as DriverStatus,
    currentNodeId: nodeIds[Math.floor(Math.random() * nodeIds.length)],
    progress: 0, route: [], routeIndex: 0,
    speed: baseSpeed + Math.random() * 0.2, rating: 3.5 + Math.random() * 1.5,
    totalDeliveries: 0, experience: 0, fatigue: 0,
  };
}

function createOrder(): Order {
  const restaurants = getRestaurantBuildings();
  const dropoffs = getDropoffBuildings();
  const restaurant = randomItem(restaurants);
  let dropoff = randomItem(dropoffs);
  const restaurantZone = getZoneForNode(restaurant.nodeId);
  const differentZoneDropoffs = dropoffs.filter(b => getZoneForNode(b.nodeId) !== restaurantZone);
  if (differentZoneDropoffs.length > 0 && Math.random() > 0.3) dropoff = randomItem(differentZoneDropoffs);
  const prepTime = COOK_TIME_BASE + Math.floor(Math.random() * COOK_TIME_VARIANCE);
  return {
    id: `order-${generateId()}`, customerName: randomItem(CUSTOMER_NAMES),
    restaurantName: restaurant.name, restaurantNodeId: restaurant.nodeId,
    customerNodeId: dropoff.nodeId, status: 'CREATED' as OrderStatus, priority: 1,
    estimatedValue: Math.round(10 + Math.random() * 30), createdAt: Date.now(), mood: 'HAPPY' as CustomerMood,
    cookTimeRemaining: prepTime, estimatedPrepTime: prepTime,
  };
}

function computeCustomerMood(order: Order, simElapsed: number): CustomerMood {
  if (order.status === 'DELIVERED') return 'HAPPY';
  const waitSeconds = (Date.now() - order.createdAt) / 1000;
  if (waitSeconds < 20) return 'HAPPY';
  if (waitSeconds < 40) return 'WAITING';
  if (waitSeconds < 55) return 'FRUSTRATED';
  return 'ANGRY';
}

function computeZoneHeats(orders: Order[]): ZoneHeat[] {
  const zoneCounts: Record<string, number> = {};
  for (const order of orders) {
    if (order.status === 'DELIVERED') continue;
    const zone = getZoneForNode(order.restaurantNodeId);
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  }
  return Object.entries(zoneCounts).map(([zoneName, orderCount]) => {
    let intensity: ZoneHeat['intensity'] = 'LOW';
    if (orderCount >= 8) intensity = 'SURGE';
    else if (orderCount >= 5) intensity = 'HIGH';
    else if (orderCount >= 3) intensity = 'MEDIUM';
    return { zoneName, orderCount, intensity };
  });
}

function computeNetworkHealth(orders: Order[], drivers: Driver[], incidents: Incident[]): NetworkHealth {
  const total = orders.length || 1;
  const delayed = orders.filter(o => o.status === 'DELAYED').length;
  const angry = orders.filter(o => o.mood === 'ANGRY').length;
  const delayedRatio = delayed / total;
  const angryRatio = angry / total;
  const activeIncidents = incidents.length;
  const idleDrivers = drivers.filter(d => d.status === 'IDLE').length;
  const totalDrivers = drivers.filter(d => d.status !== 'OFFLINE').length;
  const pending = orders.filter(o => o.status === 'CREATED' || o.status === 'FINDING_DRIVER').length;
  const overloaded = pending > totalDrivers * 2;

  if (delayedRatio > 0.2 || angryRatio > 0.15 || activeIncidents >= 4 || overloaded) return 'critical';
  if (delayedRatio > 0.08 || angryRatio > 0.05 || activeIncidents >= 2 || pending > totalDrivers) return 'busy';
  return 'stable';
}

function computeCustomerSatisfaction(orders: Order[]): number {
  const rated = orders.filter(o => o.status === 'DELIVERED' || o.mood !== 'HAPPY');
  if (rated.length === 0) return 100;
  const happy = orders.filter(o => o.mood === 'HAPPY' || o.status === 'DELIVERED').length;
  return Math.round((happy / Math.max(orders.length, 1)) * 100);
}

function computeMetrics(drivers: Driver[], orders: Order[], zoneHeats: ZoneHeat[], records: DeliveryRecord[], elapsed: number, incidents: Incident[]): Metrics {
  const busyDrivers = drivers.filter(d => ['EN_ROUTE_PICKUP', 'WAITING_AT_RESTAURANT', 'DELIVERING'].includes(d.status)).length;
  const totalNonOffline = drivers.filter(d => d.status !== 'OFFLINE').length;
  const completedDeliveries = orders.filter(o => o.status === 'DELIVERED').length;
  const delayedOrders = orders.filter(o => o.status === 'DELAYED').length;
  const driverUtilization = totalNonOffline > 0 ? Math.round((busyDrivers / totalNonOffline) * 100) : 0;
  const pendingOrders = orders.filter(o => !['DELIVERED', 'DELAYED'].includes(o.status)).length;

  const activeDriversWithRoutes = drivers.filter(d => d.route.length > 1 && d.routeIndex < d.route.length - 1 && (d.status === 'EN_ROUTE_PICKUP' || d.status === 'DELIVERING'));
  let avgEta = 0;
  if (activeDriversWithRoutes.length > 0) {
    let totalEta = 0;
    for (const d of activeDriversWithRoutes) {
      let remaining = 0;
      const curEdge = getEdgeBetween(d.route[d.routeIndex], d.route[d.routeIndex + 1] ?? d.route[d.routeIndex]);
      remaining += (curEdge?.distance ?? 60) * (1 - d.progress);
      for (let i = d.routeIndex + 1; i < d.route.length - 1; i++) { remaining += getEdgeBetween(d.route[i], d.route[i + 1])?.distance ?? 60; }
      totalEta += remaining / Math.max(d.speed * 4, 0.1) / 60;
    }
    avgEta = totalEta / activeDriversWithRoutes.length;
  }

  return {
    activeDrivers: busyDrivers, pendingOrders, averageEta: Math.round(avgEta * 10) / 10,
    completedDeliveries, delayedOrders, driverUtilization,
    dispatchSuccessRate: 0, activeHotspots: zoneHeats.filter(z => z.intensity === 'HIGH' || z.intensity === 'SURGE').length,
    velocityScore: 0, revenue: 0,
    deliveryPercentiles: computePercentiles(records),
    ordersPerMinute: elapsed > 0 ? Math.round((completedDeliveries / (elapsed / 60)) * 10) / 10 : 0,
    networkHealth: computeNetworkHealth(orders, drivers, incidents),
    customerSatisfaction: computeCustomerSatisfaction(orders),
    activeIncidents: incidents.length,
  };
}

// --- Incident Generation ---
function generateIncident(tickCount: number, zones: string[]): Incident | null {
  const roll = Math.random();
  const zone = randomItem(zones);
  const id = `inc-${generateId()}`;
  const now = Date.now();

  if (roll < 0.18) {
    return { id, type: 'traffic_jam', message: `🚧 Traffic jam in ${zone}`, severity: 'warning', zone, startTick: tickCount, durationTicks: 600 + Math.floor(Math.random() * 600), timestamp: now };
  }
  if (roll < 0.28) {
    return { id, type: 'rain', message: '🌧️ Heavy rain — all drivers slowed', severity: 'warning', startTick: tickCount, durationTicks: 900 + Math.floor(Math.random() * 600), timestamp: now };
  }
  if (roll < 0.38) {
    const edge = randomItem(ROAD_EDGES);
    return { id, type: 'accident', message: `🚨 Accident reported — drivers rerouting`, severity: 'critical', affectedEdgeId: edge.id, zone, startTick: tickCount, durationTicks: 400 + Math.floor(Math.random() * 400), timestamp: now };
  }
  if (roll < 0.52) {
    const restaurant = randomItem(getRestaurantBuildings());
    return { id, type: 'restaurant_delay', message: `🍳 ${restaurant.name} kitchen backed up`, severity: 'info', affectedBuildingId: restaurant.id, startTick: tickCount, durationTicks: 500 + Math.floor(Math.random() * 400), timestamp: now };
  }
  if (roll < 0.65) {
    return { id, type: 'demand_spike', message: `📈 Demand surge in ${zone}`, severity: 'warning', zone, startTick: tickCount, durationTicks: 400 + Math.floor(Math.random() * 300), timestamp: now };
  }
  return null;
}

// --- Initial State ---
const STARTING_BIKES = 4;
const STARTING_CARS = 2;

function createInitialState() {
  let idx = 0;
  const drivers: Driver[] = [];
  for (let i = 0; i < STARTING_BIKES; i++) drivers.push(createDriver(idx++, 'BIKE'));
  for (let i = 0; i < STARTING_CARS; i++) drivers.push(createDriver(idx++, 'CAR'));
  const orders = Array.from({ length: 3 }, () => createOrder());
  const zoneHeats = computeZoneHeats(orders);
  return {
    isRunning: true, speed: 1, elapsedTime: 0, simTime: 0, tickCount: 0,
    drivers, orders, dispatchDecisions: [] as DispatchDecision[],
    metrics: computeMetrics(drivers, orders, zoneHeats, [], 0, []),
    zoneHeats, trafficMultiplier: 1.0,
    incidents: [] as Incident[], incidentLog: [] as IncidentLogEntry[],
    deliveryRecords: [] as DeliveryRecord[],
  };
}

// --- Store Interface ---
interface SimulationStore {
  isRunning: boolean;
  speed: number;
  elapsedTime: number;
  simTime: number;
  tickCount: number;
  drivers: Driver[];
  orders: Order[];
  dispatchDecisions: DispatchDecision[];
  metrics: Metrics;
  zoneHeats: ZoneHeat[];
  trafficMultiplier: number;
  incidents: Incident[];
  incidentLog: IncidentLogEntry[];
  deliveryRecords: DeliveryRecord[];

  start: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;

  deployDriver: (type: VehicleType) => void;
  relocateToZone: (zoneName: string) => void;
  rushDelayed: () => void;
  boostDriver: (driverId: string) => void;
  recallDriver: (driverId: string) => void;
  rushOrder: (orderId: string) => void;
  manualAssign: (driverId: string, orderId: string) => void;

  tick: () => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  ...createInitialState(),

  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  reset: () => set(createInitialState()),
  setSpeed: (speed: number) => set({ speed }),

  deployDriver: (type: VehicleType) => {
    const driver = createDriver(get().drivers.length, type);
    set(s => ({
      drivers: [...s.drivers, driver],
      incidentLog: [{ id: generateId(), message: `${type === 'CAR' ? '🚗' : '🏍️'} ${driver.name} deployed`, severity: 'info' as const, timestamp: Date.now() }, ...s.incidentLog].slice(0, 50),
    }));
  },

  relocateToZone: (zoneName: string) => {
    const state = get();
    const zoneNodes = ROAD_NODES.filter(n => n.zone === zoneName);
    if (zoneNodes.length === 0) return;
    const targetNode = randomItem(zoneNodes);
    let moved = 0;
    const drivers = state.drivers.map(d => {
      if (moved >= 3 || d.status !== 'IDLE') return d;
      const path = findPath(d.currentNodeId, targetNode.id);
      if (!path || path.nodeIds.length < 2) return d;
      moved++;
      return { ...d, route: path.nodeIds, routeIndex: 0, progress: 0, targetNodeId: path.nodeIds[1], statusDetail: `Relocating to ${zoneName}` };
    });
    if (moved > 0) {
      set({
        drivers,
        incidentLog: [{ id: generateId(), message: `📍 ${moved} driver${moved > 1 ? 's' : ''} relocating to ${zoneName}`, severity: 'info' as const, timestamp: Date.now() }, ...state.incidentLog].slice(0, 50),
      });
    }
  },

  rushDelayed: () => {
    set(s => {
      const rushed = s.orders.filter(o => o.mood === 'FRUSTRATED' || o.mood === 'ANGRY' || o.status === 'DELAYED');
      if (rushed.length === 0) return {};
      return {
        orders: s.orders.map(o => (o.mood === 'FRUSTRATED' || o.mood === 'ANGRY' || o.status === 'DELAYED') ? { ...o, priority: 10 } : o),
        incidentLog: [{ id: generateId(), message: `🚨 ${rushed.length} delayed orders prioritized`, severity: 'warning' as const, timestamp: Date.now() }, ...s.incidentLog].slice(0, 50),
      };
    });
  },

  boostDriver: (driverId: string) => {
    set(s => ({
      drivers: s.drivers.map(d => d.id === driverId ? { ...d, speed: d.speed * 1.5, statusDetail: 'Incentive boost active' } : d),
    }));
    setTimeout(() => {
      set(s => ({
        drivers: s.drivers.map(d => {
          if (d.id !== driverId) return d;
          const baseSpeed = d.vehicleType === 'CAR' ? 1.0 : 0.8;
          return { ...d, speed: baseSpeed + Math.random() * 0.2, statusDetail: undefined };
        }),
      }));
    }, 30000);
  },

  recallDriver: (driverId: string) => {
    set(s => {
      const driver = s.drivers.find(d => d.id === driverId);
      if (!driver || driver.status === 'IDLE' || driver.status === 'OFFLINE' || driver.status === 'ON_BREAK') return {};
      const orderId = driver.currentOrderId;
      return {
        drivers: s.drivers.map(d => d.id === driverId ? { ...d, status: 'IDLE' as DriverStatus, currentOrderId: undefined, route: [], routeIndex: 0, progress: 0, targetNodeId: undefined, statusDetail: undefined } : d),
        orders: orderId ? s.orders.map(o => o.id === orderId ? { ...o, status: 'CREATED' as OrderStatus, driverId: undefined, assignedAt: undefined } : o) : s.orders,
      };
    });
  },

  rushOrder: (orderId: string) => {
    set(s => ({
      orders: s.orders.map(o => o.id === orderId ? { ...o, priority: 10 } : o),
      incidentLog: [{ id: generateId(), message: `⚡ Order rushed`, severity: 'info' as const, timestamp: Date.now() }, ...s.incidentLog].slice(0, 50),
    }));
  },

  manualAssign: (driverId: string, orderId: string) => {
    const state = get();
    const driver = state.drivers.find(d => d.id === driverId);
    const order = state.orders.find(o => o.id === orderId);
    if (!driver || !order || driver.status !== 'IDLE') return;
    if (!['CREATED', 'FINDING_DRIVER'].includes(order.status)) return;
    const pathResult = findPath(driver.currentNodeId, order.restaurantNodeId);
    set(s => ({
      orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'EN_ROUTE_PICKUP' as OrderStatus, driverId, assignedAt: Date.now() } : o),
      drivers: s.drivers.map(d => d.id === driverId ? { ...d, status: 'EN_ROUTE_PICKUP' as DriverStatus, currentOrderId: orderId, route: pathResult?.nodeIds ?? [], routeIndex: 0, progress: 0, targetNodeId: pathResult?.nodeIds?.[1], statusDetail: `Heading to ${order.restaurantName}` } : d),
      dispatchDecisions: [{ id: `dd-${generateId()}`, orderId, driverId, driverName: driver.name, restaurantName: order.restaurantName, score: 0, reason: 'Manual assignment', distance: pathResult?.totalDistance ?? 0, eta: pathResult?.totalCost ?? 0, timestamp: Date.now() }, ...s.dispatchDecisions].slice(0, 30),
    }));
  },

  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    const { speed, tickCount } = state;
    let drivers = [...state.drivers];
    let orders = [...state.orders];
    let dispatchDecisions = [...state.dispatchDecisions];
    let deliveryRecords = [...state.deliveryRecords];
    let incidents = [...state.incidents];
    let incidentLog = [...state.incidentLog];
    let trafficMultiplier = 1.0;

    // --- 1. Generate random incidents ---
    if (tickCount > 0 && tickCount % Math.floor(INCIDENT_CHECK_INTERVAL / speed) === 0) {
      const zoneNames = CITY_ZONES.map(z => z.name);
      const newIncident = generateIncident(tickCount, zoneNames);
      if (newIncident && incidents.length < 6) {
        incidents.push(newIncident);
        incidentLog = [{ id: newIncident.id, message: newIncident.message, severity: newIncident.severity, timestamp: Date.now() }, ...incidentLog].slice(0, 50);
      }
    }

    // --- 2. Expire old incidents ---
    incidents = incidents.filter(inc => tickCount - inc.startTick < inc.durationTicks);

    // --- 3. Compute traffic multiplier from active incidents ---
    const hasRain = incidents.some(i => i.type === 'rain');
    const trafficJamZones = new Set(incidents.filter(i => i.type === 'traffic_jam').map(i => i.zone));
    const accidentEdges = new Set(incidents.filter(i => i.type === 'accident').map(i => i.affectedEdgeId));
    const delayedRestaurants = new Set(incidents.filter(i => i.type === 'restaurant_delay').map(i => i.affectedBuildingId));
    const demandSpikeZones = new Set(incidents.filter(i => i.type === 'demand_spike').map(i => i.zone));

    trafficMultiplier = 1.0;
    if (hasRain) trafficMultiplier *= 1.4;
    if (trafficJamZones.size > 0) trafficMultiplier *= 1.3;
    if (accidentEdges.size > 0) trafficMultiplier *= 1.2;

    // --- 4. Move drivers ---
    drivers = drivers.map(driver => {
      // Clear expired reroute highlight
      if (driver.reroutingUntilTick && tickCount >= driver.reroutingUntilTick) {
        driver = { ...driver, reroutingUntilTick: undefined };
        if (driver.thoughtMessage?.includes('Accident ahead')) {
          driver = { ...driver, thoughtMessage: undefined };
        }
      }

      // Handle break completion
      if (driver.status === 'ON_BREAK') {
        if (driver.breakUntilTick && tickCount >= driver.breakUntilTick) {
          return { ...driver, status: 'IDLE' as DriverStatus, fatigue: 15, breakUntilTick: undefined, statusDetail: 'Back from break' };
        }
        return driver;
      }

      if (driver.route.length === 0 || driver.routeIndex >= driver.route.length - 1) return driver;

      const currentNodeId = driver.route[driver.routeIndex];
      const nextNodeId = driver.route[driver.routeIndex + 1];
      const edge = getEdgeBetween(currentNodeId, nextNodeId);
      const edgeDistance = edge?.distance ?? 60;

      let effectiveSpeed = driver.speed;
      // Apply traffic effects
      if (hasRain) effectiveSpeed *= (driver.vehicleType === 'BIKE' ? 0.6 : 0.8);
      const driverZone = getZoneForNode(currentNodeId);
      if (trafficJamZones.has(driverZone)) effectiveSpeed *= 0.4;
      if (edge && accidentEdges.has(edge.id)) effectiveSpeed *= 0.2;
      // Fatigue slows drivers
      if (driver.fatigue > 70) effectiveSpeed *= 0.8;
      effectiveSpeed *= (1 + driver.experience * 0.005);

      const progressIncrement = (effectiveSpeed * speed * MOVE_SPEED_FACTOR) / (edgeDistance * 0.01);
      const newProgress = driver.progress + progressIncrement;

      if (newProgress >= 1) {
        const newRouteIndex = driver.routeIndex + 1;
        if (newRouteIndex >= driver.route.length - 1) {
          return { ...driver, progress: 0, routeIndex: newRouteIndex, currentNodeId: driver.route[newRouteIndex], targetNodeId: undefined };
        }
        return { ...driver, progress: 0, routeIndex: newRouteIndex, currentNodeId: driver.route[newRouteIndex], targetNodeId: driver.route[newRouteIndex + 1] };
      }
      return { ...driver, progress: newProgress, currentNodeId, targetNodeId: nextNodeId };
    });

    // --- 5. Check arrivals & delivery pipeline ---
    drivers = drivers.map(driver => {
      if (!driver.currentOrderId) return driver;
      const order = orders.find(o => o.id === driver.currentOrderId);
      if (!order) return driver;
      const atEnd = driver.routeIndex >= driver.route.length - 1;

      // Arrived at restaurant
      if (driver.status === 'EN_ROUTE_PICKUP' && atEnd) {
        if (order.cookTimeRemaining && order.cookTimeRemaining > 0) {
          orders = orders.map(o => o.id === order.id ? { ...o, status: 'WAITING_FOR_FOOD' as OrderStatus } : o);
          return { ...driver, status: 'WAITING_AT_RESTAURANT' as DriverStatus, route: [], routeIndex: 0, progress: 0, targetNodeId: undefined, statusDetail: `Waiting for food at ${order.restaurantName}` };
        }
        // Food already ready
        orders = orders.map(o => o.id === order.id ? { ...o, status: 'PICKED_UP' as OrderStatus, cookTimeRemaining: 0 } : o);
        const pathResult = findPath(driver.currentNodeId, order.customerNodeId);
        if (pathResult && pathResult.nodeIds.length > 1) {
          orders = orders.map(o => o.id === order.id ? { ...o, status: 'EN_ROUTE_DELIVERY' as OrderStatus } : o);
          return { ...driver, status: 'DELIVERING' as DriverStatus, route: pathResult.nodeIds, routeIndex: 0, progress: 0, targetNodeId: pathResult.nodeIds[1], statusDetail: `Delivering to ${order.customerName}` };
        }
      }

      // Waiting at restaurant — check if food is ready
      if (driver.status === 'WAITING_AT_RESTAURANT') {
        const currentOrder = orders.find(o => o.id === driver.currentOrderId);
        if (currentOrder && currentOrder.cookTimeRemaining !== undefined && currentOrder.cookTimeRemaining <= 0) {
          orders = orders.map(o => o.id === driver.currentOrderId ? { ...o, status: 'EN_ROUTE_DELIVERY' as OrderStatus, cookTimeRemaining: 0 } : o);
          const updatedOrder = orders.find(o => o.id === driver.currentOrderId)!;
          const pathResult = findPath(driver.currentNodeId, updatedOrder.customerNodeId);
          if (pathResult && pathResult.nodeIds.length > 1) {
            return { ...driver, status: 'DELIVERING' as DriverStatus, route: pathResult.nodeIds, routeIndex: 0, progress: 0, targetNodeId: pathResult.nodeIds[1], statusDetail: `Delivering to ${updatedOrder.customerName}` };
          }
        }
        return driver;
      }

      // Arrived at customer
      if (driver.status === 'DELIVERING' && atEnd) {
        deliveryRecords.push({ orderId: order.id, durationMs: Date.now() - order.createdAt, timestamp: Date.now() });
        if (deliveryRecords.length > 200) deliveryRecords = deliveryRecords.slice(-150);

        orders = orders.map(o => o.id === order.id ? { ...o, status: 'DELIVERED' as OrderStatus, deliveredAt: Date.now(), mood: 'HAPPY' as CustomerMood } : o);

        const newFatigue = driver.fatigue + FATIGUE_PER_DELIVERY;
        if (newFatigue >= FATIGUE_BREAK_THRESHOLD) {
          incidentLog = [{ id: generateId(), message: `😴 ${driver.name} taking a break (fatigued)`, severity: 'info' as const, timestamp: Date.now() }, ...incidentLog].slice(0, 50);
          return { ...driver, status: 'ON_BREAK' as DriverStatus, currentOrderId: undefined, route: [], routeIndex: 0, progress: 0, targetNodeId: undefined, totalDeliveries: driver.totalDeliveries + 1, experience: driver.experience + 1, fatigue: newFatigue, breakUntilTick: tickCount + BREAK_DURATION, statusDetail: 'Taking a break' };
        }

        return { ...driver, status: 'IDLE' as DriverStatus, currentOrderId: undefined, route: [], routeIndex: 0, progress: 0, targetNodeId: undefined, totalDeliveries: driver.totalDeliveries + 1, experience: driver.experience + 1, fatigue: newFatigue, statusDetail: undefined };
      }
      return driver;
    });

    // --- 6. Advance cook timers ---
    const cookSpeedMult = speed;
    orders = orders.map(o => {
      if (o.cookTimeRemaining === undefined || o.cookTimeRemaining <= 0) return o;
      const restaurant = BUILDINGS.find(b => b.nodeId === o.restaurantNodeId);
      let cookSpeed = cookSpeedMult;
      if (restaurant && delayedRestaurants.has(restaurant.id)) cookSpeed *= 0.4;
      let newCookTime = o.cookTimeRemaining - cookSpeed;
      // Check restaurant overload
      const queueSize = orders.filter(ord => ord.restaurantNodeId === o.restaurantNodeId && ord.cookTimeRemaining !== undefined && ord.cookTimeRemaining > 0).length;
      if (queueSize > 3) newCookTime = o.cookTimeRemaining - (cookSpeed * 0.5);
      return { ...o, cookTimeRemaining: Math.max(0, newCookTime) };
    });

    // --- 7. Update customer moods ---
    orders = orders.map(o => o.status === 'DELIVERED' ? o : { ...o, mood: computeCustomerMood(o, state.simTime) });

    // --- 8. Spawn orders ---
    let spawnInterval = Math.floor(BASE_ORDER_INTERVAL / speed);
    if (tickCount > 0 && tickCount % Math.max(1, spawnInterval) === 0) {
      const baseChance = 0.4;
      orders.push(createOrder());
      // Extra orders in demand spike zones
      for (const zone of demandSpikeZones) {
        if (Math.random() < 0.5) {
          const zoneRestaurants = getRestaurantBuildings().filter(b => b.zone === zone);
          if (zoneRestaurants.length > 0) {
            const r = randomItem(zoneRestaurants);
            const dropoff = randomItem(getDropoffBuildings());
            orders.push({
              ...createOrder(),
              restaurantName: r.name, restaurantNodeId: r.nodeId,
              delayReason: `Demand spike in ${zone}`,
            });
          }
        }
      }
    }

    // --- 9. Cleanup old delivered ---
    if (orders.length > 80) {
      const delivered = orders.filter(o => o.status === 'DELIVERED');
      if (delivered.length > 25) {
        const toRemove = new Set(delivered.slice(0, delivered.length - 20).map(o => o.id));
        orders = orders.filter(o => !toRemove.has(o.id));
      }
    }

    // --- 10. Dispatch ---
    const pendingOrders = orders.filter(o => o.status === 'CREATED' || o.status === 'FINDING_DRIVER').sort((a, b) => b.priority - a.priority);
    const idleDrivers = drivers.filter(d => d.status === 'IDLE');
    if (pendingOrders.length > 0 && idleDrivers.length > 0) {
      // Mark orders as finding driver briefly
      orders = orders.map(o => o.status === 'CREATED' ? { ...o, status: 'FINDING_DRIVER' as OrderStatus } : o);

      const decisions = runDispatch(
        orders.filter(o => o.status === 'FINDING_DRIVER').sort((a, b) => b.priority - a.priority),
        idleDrivers,
        trafficMultiplier
      );
      for (const decision of decisions) {
        const driverNode = drivers.find(d => d.id === decision.driverId)?.currentNodeId;
        const order = orders.find(o => o.id === decision.orderId);
        if (!driverNode || !order) continue;
        orders = orders.map(o => o.id === decision.orderId ? { ...o, status: 'EN_ROUTE_PICKUP' as OrderStatus, driverId: decision.driverId, assignedAt: Date.now() } : o);
        const pathResult = findPath(driverNode, order.restaurantNodeId);
        drivers = drivers.map(d => d.id !== decision.driverId ? d : { ...d, status: 'EN_ROUTE_PICKUP' as DriverStatus, currentOrderId: decision.orderId, route: pathResult?.nodeIds ?? [], routeIndex: 0, progress: 0, targetNodeId: pathResult?.nodeIds?.[1], statusDetail: `Heading to ${order.restaurantName}` });
      }
      dispatchDecisions = [...decisions, ...dispatchDecisions].slice(0, 30);
    }

    // --- 11. Mark delayed ---
    orders = orders.map(o => {
      if (['CREATED', 'FINDING_DRIVER'].includes(o.status) && Date.now() - o.createdAt > DELAYED_THRESHOLD_MS) {
        return { ...o, status: 'DELAYED' as OrderStatus, delayReason: 'No driver available' };
      }
      return o;
    });

    // --- 12. Reroute drivers affected by new incidents ---
    if (accidentEdges.size > 0) {
      drivers = drivers.map(driver => {
        if (driver.status !== 'EN_ROUTE_PICKUP' && driver.status !== 'DELIVERING') return driver;
        const remainingRoute = driver.route.slice(driver.routeIndex);
        const affectedByAccident = remainingRoute.some((nodeId, i) => {
          if (i >= remainingRoute.length - 1) return false;
          const edge = getEdgeBetween(nodeId, remainingRoute[i + 1]);
          return edge && accidentEdges.has(edge.id);
        });
        if (!affectedByAccident) return driver;

        const destination = driver.route[driver.route.length - 1];
        if (!destination) return driver;
        const newPath = findPath(driver.currentNodeId, destination);
        if (!newPath || newPath.nodeIds.length < 2) return driver;

        incidentLog = [{ id: generateId(), message: `🚧 ${driver.name}: road blocked — detour in progress`, severity: 'warning' as const, timestamp: Date.now() }, ...incidentLog].slice(0, 50);
        return {
          ...driver,
          route: newPath.nodeIds, routeIndex: 0, progress: 0, targetNodeId: newPath.nodeIds[1],
          statusDetail: 'Recalculating route',
          thoughtMessage: '🚧 Accident ahead! Finding another way...',
          reroutingUntilTick: tickCount + 300,
        };
      });
    }

    const newElapsed = state.elapsedTime + (1 / 60) * speed;
    const newSimTime = state.simTime + (1 / 60) * speed * SIM_SPEED_MULT;
    const zoneHeats = computeZoneHeats(orders);
    const metrics = computeMetrics(drivers, orders, zoneHeats, deliveryRecords, newElapsed, incidents);

    set({
      drivers, orders, dispatchDecisions, metrics, zoneHeats, deliveryRecords,
      incidents, incidentLog, trafficMultiplier,
      tickCount: tickCount + 1, elapsedTime: newElapsed, simTime: newSimTime,
    });
  },
}));
