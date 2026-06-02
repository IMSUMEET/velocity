export type VehicleType = 'CAR' | 'BIKE';
export type DriverStatus = 'IDLE' | 'EN_ROUTE_PICKUP' | 'WAITING_AT_RESTAURANT' | 'DELIVERING' | 'ON_BREAK' | 'OFFLINE';
export type OrderStatus = 'CREATED' | 'FINDING_DRIVER' | 'EN_ROUTE_PICKUP' | 'WAITING_FOR_FOOD' | 'PICKED_UP' | 'EN_ROUTE_DELIVERY' | 'DELIVERED' | 'DELAYED';
export type CustomerMood = 'HAPPY' | 'WAITING' | 'FRUSTRATED' | 'ANGRY';
export type NetworkHealth = 'stable' | 'busy' | 'critical';

export interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  status: DriverStatus;
  currentNodeId: string;
  targetNodeId?: string;
  progress: number;
  currentOrderId?: string;
  route: string[];
  routeIndex: number;
  speed: number;
  rating: number;
  totalDeliveries: number;
  experience: number;
  fatigue: number;
  breakUntilTick?: number;
  statusDetail?: string;
  thoughtMessage?: string;
  reroutingUntilTick?: number;
  orderBatch?: string[];
  batchId?: string;
  batchSize?: number;
}

export interface Order {
  id: string;
  customerName: string;
  restaurantName: string;
  restaurantNodeId: string;
  customerNodeId: string;
  status: OrderStatus;
  priority: number;
  estimatedValue: number;
  createdAt: number;
  assignedAt?: number;
  deliveredAt?: number;
  driverId?: string;
  mood: CustomerMood;
  cookTimeRemaining?: number;
  estimatedPrepTime?: number;
  estimatedDeliveryTime?: number;
  delayReason?: string;
  batchId?: string;
  batchPosition?: number;
}

export interface DispatchDecision {
  id: string;
  orderId: string;
  driverId: string;
  driverName: string;
  restaurantName: string;
  score: number;
  reason: string;
  distance: number;
  eta: number;
  timestamp: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  distanceScore: number;
  etaScore: number;
  orderAgeScore: number;
  vehicleBonus: number;
  experienceBonus: number;
  batchBonus: number;
  total: number;
}

export interface Incident {
  id: string;
  type: 'traffic_jam' | 'rain' | 'accident' | 'restaurant_delay' | 'demand_spike' | 'driver_fatigue';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  zone?: string;
  affectedEdgeId?: string;
  affectedBuildingId?: string;
  startTick: number;
  durationTicks: number;
  timestamp: number;
}

export interface IncidentLogEntry {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
}

export interface GameEvent {
  id: string;
  type: string;
  affectedZone?: string;
  affectedNodeId?: string;
  duration: number;
  startTick: number;
  message: string;
}

export interface DeliveryRecord {
  orderId: string;
  durationMs: number;
  timestamp: number;
}

export interface PercentileMetrics {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export interface Metrics {
  activeDrivers: number;
  pendingOrders: number;
  averageEta: number;
  completedDeliveries: number;
  delayedOrders: number;
  driverUtilization: number;
  dispatchSuccessRate: number;
  activeHotspots: number;
  velocityScore: number;
  revenue: number;
  deliveryPercentiles: PercentileMetrics;
  ordersPerMinute: number;
  networkHealth: NetworkHealth;
  customerSatisfaction: number;
  activeIncidents: number;
}

export interface ZoneHeat {
  zoneName: string;
  orderCount: number;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'SURGE';
}
