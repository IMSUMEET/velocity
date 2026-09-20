// ---- Dispatch strategies -------------------------------------------------
export const STRATEGIES = [
  "FASTEST_ETA",
  "LOWEST_COST",
  "BALANCED",
  "BATCH_NEARBY",
  "BATCH_OPTIMAL",
] as const;
export type DispatchStrategy = (typeof STRATEGIES)[number];

export const STRATEGY_META: Record<
  DispatchStrategy,
  { label: string; kind: "greedy" | "batch"; blurb: string }
> = {
  FASTEST_ETA: { label: "Fastest ETA", kind: "greedy", blurb: "Minimise time to the customer's door." },
  LOWEST_COST: { label: "Lowest Cost", kind: "greedy", blurb: "Minimise total fleet distance." },
  BALANCED: { label: "Balanced", kind: "greedy", blurb: "Multi-factor: distance + ETA + order age." },
  BATCH_NEARBY: { label: "Batch Nearby", kind: "batch", blurb: "Hold & group proximal orders (nearest-neighbour)." },
  BATCH_OPTIMAL: { label: "Batch Optimal", kind: "batch", blurb: "Hold & group via greedy TSP insertion." },
};

// ---- Enums ---------------------------------------------------------------
export type VehicleType = "CAR" | "BIKE";

export type DriverStatus =
  | "IDLE"
  | "EN_ROUTE_PICKUP"
  | "WAITING_AT_RESTAURANT"
  | "DELIVERING"
  | "ON_BREAK"
  | "OFFLINE";

export type OrderStatus =
  | "CREATED"
  | "FINDING_DRIVER"
  | "EN_ROUTE_PICKUP"
  | "WAITING_FOR_FOOD"
  | "EN_ROUTE_DELIVERY"
  | "DELIVERED";

export type IncidentType =
  | "TRAFFIC_JAM"
  | "ACCIDENT"
  | "RESTAURANT_DELAY"
  | "DEMAND_SPIKE"
  | "DRIVER_OFFLINE";

export type Mood = "HAPPY" | "WAITING" | "FRUSTRATED" | "ANGRY";

// ---- Map graph -----------------------------------------------------------
export interface MapNode { id: string; x: number; y: number; name: string; zone: string; }
export interface MapEdge {
  id: string; from: string; to: string; distance: number;
  speedLimit: number; congestion: number; isMajor: boolean;
}
export interface MapBuilding {
  id: string; name: string; type: string; nodeId: string;
  x: number; y: number; zone: string; icon: string;
}
export interface MapZone {
  id: string; name: string; centerX: number; centerY: number;
  radius: number; color: string; labelX: number; labelY: number;
}
export interface CityMapData {
  nodes: MapNode[]; edges: MapEdge[]; buildings: MapBuilding[]; zones: MapZone[];
}

// ---- Simulation state ----------------------------------------------------
export interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  status: DriverStatus;
  currentNodeId: string;
  targetNodeId: string | null;
  route: string[];
  routeIndex: number;
  progress: number;      // 0..1 along current edge
  speed: number;
  rating: number;
  fatigue: number;
  experience: number;
  totalDeliveries: number;
  totalMiles: number;
  currentOrderId: string | null;
  thought: string | null;
  breakUntilTick: number | null;
  // batch
  batchId: string | null;
  orderBatch: string[];
  batchSize: number;
  batchStopIndex: number;
  batchStopNodes: string[];
}

export interface Order {
  id: string;
  traceId: string;
  customerName: string;
  restaurantName: string;
  restaurantNodeId: string;
  customerNodeId: string;
  status: OrderStatus;
  priority: number;
  estimatedValue: number;
  createdTick: number;
  assignedTick: number | null;
  deliveredTick: number | null;
  cookTimeRemaining: number;
  mood: Mood;
  delayed: boolean;
  driverId: string | null;
  batchId: string | null;
  batchPosition: number | null;
  holdStartTick: number | null;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  title: string;
  message: string;
  zone: string;
  startTick: number;
  durationTicks: number;
  resolved: boolean;
  mitigated: boolean;
  affectedEdgeId: string | null;
  affectedDriverId: string | null;
}

export interface ScoreBreakdown {
  distance: number; eta: number; orderAge: number;
  experience: number; vehicle: number; total: number;
}
export interface DispatchCandidate {
  driverId: string; driverName: string; vehicleType: VehicleType;
  score: number; distance: number; eta: number;
  breakdown: ScoreBreakdown; selected: boolean; rejectReason: string | null;
}
export interface DispatchAttempt {
  id: string; orderId: string; restaurantName: string; strategy: DispatchStrategy;
  tick: number; matched: boolean;
  selectedDriverId: string | null; selectedDriverName: string | null;
  score: number; distance: number; eta: number; candidatesEvaluated: number;
  candidates: DispatchCandidate[]; reason: string;
  batchId: string | null; batchSize: number; batchSavingsPercent: number;
}

export interface BatchPlan {
  id: string; driverId: string; orderIds: string[]; routeNodes: string[];
  totalDistance: number; estimatedTime: number; holdTicks: number;
  greedyBaselineDistance: number; savingsPercent: number;
}

export interface TraceSpan {
  spanId: string; service: string; operation: string;
  startOffsetTicks: number; durationTicks: number; status: string; detail: string;
}
export interface OrderTrace {
  traceId: string; orderId: string; startTick: number;
  currentStatus: string; spans: TraceSpan[];
}

export interface PlatformEvent {
  id: string; type: string; category: string; severity: string;
  orderId: string | null; driverId: string | null; message: string; tick: number;
}

export interface QueueMetric {
  name: string; depth: number; workers: number; throughput: number; health: string;
}

export interface Metrics {
  totalDrivers: number; activeDrivers: number; idleDrivers: number;
  pendingOrders: number; inProgressOrders: number; completedDeliveries: number;
  delayedOrders: number; driverUtilization: number; ordersPerMinute: number;
  avgEta: number; revenue: number; customerSatisfaction: number;
  networkHealth: "stable" | "busy" | "critical";
  totalFleetMiles: number; milesPerDelivery: number;
  batchedOrders: number; avgBatchSize: number; holdTimeAvgSec: number;
  p50: number; p95: number; p99: number;
}

export interface Snapshot {
  tick: number;
  running: boolean;
  speed: number;
  strategy: DispatchStrategy;
  drivers: Driver[];
  orders: Order[];
  incidents: Incident[];
  dispatch: DispatchAttempt[];
  events: PlatformEvent[];
  queues: QueueMetric[];
  metrics: Metrics;
}

// ---- Experiments ---------------------------------------------------------
export interface ExperimentResult {
  strategy: DispatchStrategy;
  durationTicks: number;
  seed: number;
  totalOrders: number;
  completed: number;
  delayed: number;
  completionRate: number;
  p50: number; p95: number; p99: number; avgDeliverySec: number;
  totalFleetMiles: number; milesPerDelivery: number; driverUtilization: number;
  batchedOrders: number; avgBatchSize: number; holdTimeAvgSec: number; batchSavingsPercent: number;
  customerSatisfaction: number; revenue: number;
}
