import { create } from 'zustand';
import type { Driver, Order, Incident, DispatchDecision, Metrics, ZoneHeat } from '../types';

export interface ExperimentResult {
  strategy: string;
  durationTicks: number;
  seed: number;
  totalOrdersGenerated: number;
  completedDeliveries: number;
  delayedOrders: number;
  completionRate: number;
  p50: number;
  p95: number;
  p99: number;
  avgDeliveryTimeSec: number;
  totalFleetMiles: number;
  milesPerDelivery: number;
  driverUtilization: number;
  batchedOrders: number;
  avgBatchSize: number;
  holdTimeAvgMs: number;
  batchSavingsPercent: number;
  customerSatisfaction: number;
  revenue: number;
  runDurationMs: number;
}

export interface PlatformEvent {
  id: string;
  type: string;
  category: string;
  severity: string;
  orderId?: string;
  driverId?: string;
  traceId?: string;
  message: string;
  tick: number;
  timestamp: number;
}

export interface QueueMetric {
  name: string;
  depth: number;
  ingestRate: number;
  consumeRate: number;
  consumerLag: number;
  workers: number;
  health: string;
}

export interface DispatchCandidate {
  driverId: string;
  driverName: string;
  vehicleType: string;
  score: number;
  distance: number;
  eta: number;
  selected: boolean;
  rejectReason?: string;
  scoreBreakdown: {
    distanceScore: number;
    etaScore: number;
    orderAgeScore: number;
    vehicleBonus: number;
    experienceBonus: number;
    batchBonus: number;
    total: number;
  };
}

export interface DispatchAttempt {
  id: string;
  orderId: string;
  restaurantName: string;
  strategy: string;
  selectedDriverId?: string;
  selectedDriverName?: string;
  score: number;
  reason: string;
  distance: number;
  eta: number;
  candidatesEvaluated: number;
  matched: boolean;
  timestamp: number;
  candidates: DispatchCandidate[];
  batchId?: string;
  batchSize?: number;
  batchSavingsPercent?: number;
}

export interface TraceSpan {
  spanId: string;
  service: string;
  operation: string;
  startOffsetMs: number;
  durationMs: number;
  status: string;
  detail: string;
}

export interface OrderTrace {
  traceId: string;
  orderId: string;
  startTime: number;
  lastUpdate: number;
  currentStatus: string;
  spans: TraceSpan[];
}

export interface SimulationState {
  running: boolean;
  paused: boolean;
  speedMultiplier: number;
  tickCount: number;
  elapsedMs: number;
  totalOrdersGenerated: number;
  totalDeliveries: number;
  dispatchStrategy: string;
}

export interface PlatformIncident {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  zone?: string;
  affectedEdgeId?: string;
  affectedBuildingId?: string;
  affectedDriverId?: string;
  startTick: number;
  durationTicks: number;
  timestamp: number;
  mitigated: boolean;
  resolved: boolean;
  mitigation?: string;
}

interface PlatformStore {
  simulation: SimulationState;
  drivers: Driver[];
  orders: Order[];
  incidents: PlatformIncident[];
  metrics: Metrics;
  zones: ZoneHeat[];
  queues: QueueMetric[];
  recentDispatch: DispatchAttempt[];
  recentEvents: PlatformEvent[];
  connected: boolean;
  experimentResults: ExperimentResult[];

  applySnapshot: (snap: any) => void;
  setConnected: (c: boolean) => void;
  setExperimentResults: (results: ExperimentResult[]) => void;
}

const defaultMetrics: Metrics = {
  activeDrivers: 0, pendingOrders: 0, averageEta: 0, completedDeliveries: 0,
  delayedOrders: 0, driverUtilization: 0, dispatchSuccessRate: 0,
  activeHotspots: 0, velocityScore: 0, revenue: 0,
  deliveryPercentiles: { p50: 0, p95: 0, p99: 0, count: 0 },
  ordersPerMinute: 0, networkHealth: 'stable', customerSatisfaction: 100, activeIncidents: 0,
};

const defaultSim: SimulationState = {
  running: false, paused: false, speedMultiplier: 1, tickCount: 0,
  elapsedMs: 0, totalOrdersGenerated: 0, totalDeliveries: 0, dispatchStrategy: 'BALANCED',
};

export const usePlatformStore = create<PlatformStore>((set) => ({
  simulation: defaultSim,
  drivers: [],
  orders: [],
  incidents: [],
  metrics: defaultMetrics,
  zones: [],
  queues: [],
  recentDispatch: [],
  recentEvents: [],
  connected: false,
  experimentResults: [],

  applySnapshot: (snap: any) => {
    if (!snap) return;
    set({
      simulation: snap.simulation ?? defaultSim,
      drivers: snap.drivers ?? [],
      orders: snap.orders ?? [],
      incidents: snap.incidents ?? [],
      metrics: snap.metrics ?? defaultMetrics,
      zones: snap.zones ?? [],
      queues: snap.queues ?? [],
      recentDispatch: snap.recentDispatch ?? [],
      recentEvents: snap.recentEvents ?? [],
      connected: true,
    });
  },

  setConnected: (c) => set({ connected: c }),
  setExperimentResults: (results) => set({ experimentResults: results }),
}));
