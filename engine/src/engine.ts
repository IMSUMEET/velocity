import { CityMap } from "./cityMap";
import { findPath } from "./pathfinding";
import { evaluate, evaluateBatch } from "./dispatch";
import { Rng } from "./rng";
import { SIM, round1, round2 } from "./constants";
import type {
  DispatchAttempt, DispatchStrategy, Driver, Incident, IncidentType, Metrics,
  Order, OrderTrace, PlatformEvent, QueueMetric, Snapshot, VehicleType,
} from "./types";

const DRIVER_NAMES = [
  "Maya Chen", "Kai Rivera", "Jordan Lee", "Sam Patel", "Riley Kim", "Alex Nguyen",
  "Morgan Cruz", "Taylor Brooks", "Quinn Davis", "Drew Martin", "Avery Santos",
  "Blake Wilson", "Casey Thompson", "Jamie Reyes", "Logan Park", "Peyton Hall",
];
const CUSTOMER_NAMES = [
  "Emma S.", "Liam T.", "Olivia R.", "Noah B.", "Ava M.", "Ethan W.", "Sophia K.",
  "Mason J.", "Isabella F.", "William D.", "Mia L.", "James H.", "Harper G.",
];
const INCIDENT_TYPES: IncidentType[] = [
  "TRAFFIC_JAM", "ACCIDENT", "RESTAURANT_DELAY", "DEMAND_SPIKE", "DRIVER_OFFLINE",
];

export interface EngineOptions {
  seed?: number;
  spawnIncidents?: boolean; // off during experiments for cleaner comparison
  drivers?: number;         // fleet size (default SIM.INITIAL_DRIVERS)
  orderIntervalTicks?: number; // base ticks between order arrivals (default SIM.ORDER_GEN_BASE_TICKS)
}

/**
 * Authoritative in-memory simulation of the delivery marketplace. One tick()
 * advances the whole world deterministically for a given seed. Time is measured
 * in ticks (virtual), so latency metrics are reproducible and independent of
 * wall-clock — including in fast headless experiment runs.
 */
export class SimulationEngine {
  readonly map: CityMap;
  private rng: Rng;
  private spawnIncidents: boolean;
  private driverCount: number;
  private orderInterval: number;

  private drivers = new Map<string, Driver>();
  private orders = new Map<string, Order>();
  private incidents = new Map<string, Incident>();
  private traces = new Map<string, OrderTrace>();
  private recentDispatch: DispatchAttempt[] = [];
  private events: PlatformEvent[] = [];
  private deliveryTicks: number[] = []; // duration in ticks, newest first
  private holdQueue = new Map<string, Order>();

  strategy: DispatchStrategy = "BALANCED";
  tick = 0;
  private lastOrderTick = 0;
  private totalOrdersGenerated = 0;
  private totalDeliveries = 0;
  private orderSeq = 0;
  private driverSeq = 0;
  private incidentSeq = 0;
  private eventSeq = 0;
  private totalFleetMiles = 0;
  private batchedOrders = 0;
  private batchDispatches = 0;
  private totalHoldTicks = 0;
  private holdSamples = 0;
  private sumBatchSavings = 0;

  constructor(map: CityMap, opts: EngineOptions = {}) {
    this.map = map;
    this.rng = new Rng(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.spawnIncidents = opts.spawnIncidents ?? true;
    this.driverCount = opts.drivers ?? SIM.INITIAL_DRIVERS;
    this.orderInterval = opts.orderIntervalTicks ?? SIM.ORDER_GEN_BASE_TICKS;
    this.seedDrivers();
  }

  reseed(seed: number) {
    this.rng = new Rng(seed);
    this.reset();
    this.seedDrivers();
  }

  private seedDrivers() {
    this.drivers.clear();
    this.driverSeq = 0;
    const nodeIds = this.map.nodes.map((n) => n.id);
    for (let i = 0; i < this.driverCount; i++) {
      // ~1/3 cars, 2/3 bikes (matches the paper's 12-bike / 6-car mix)
      const type: VehicleType = i % 3 === 0 ? "CAR" : "BIKE";
      const d = this.newDriver(type, nodeIds);
      d.name = DRIVER_NAMES[i % DRIVER_NAMES.length];
      this.drivers.set(d.id, d);
    }
  }

  private newDriver(type: VehicleType, nodeIds: string[]): Driver {
    return {
      id: `driver-${++this.driverSeq}`,
      name: this.rng.pick(DRIVER_NAMES),
      vehicleType: type,
      status: "IDLE",
      currentNodeId: nodeIds[this.rng.int(0, nodeIds.length)],
      targetNodeId: null,
      route: [], routeIndex: 0, progress: 0, speed: 0,
      rating: round1(3.5 + this.rng.next() * 1.5),
      fatigue: 0, experience: 0, totalDeliveries: 0, totalMiles: 0,
      currentOrderId: null, thought: null, breakUntilTick: null,
      batchId: null, orderBatch: [], batchSize: 0, batchStopIndex: 0, batchStopNodes: [],
    };
  }

  // ----------------------------------------------------------------- tick
  step(speed = 1): void {
    this.tick++;
    this.decayIncidents();
    this.updateCookTimers(speed);
    this.checkFoodReady();
    for (const d of this.drivers.values()) this.moveDriver(d, speed);
    this.maybeGenerateOrders(speed);
    this.runDispatch();
    this.updateMoods();
    if (this.spawnIncidents) this.maybeSpawnIncident();
  }

  private emit(type: string, category: string, severity: string, msg: string, orderId: string | null = null, driverId: string | null = null) {
    this.events.unshift({
      id: `evt-${++this.eventSeq}`, type, category, severity, orderId, driverId, message: msg, tick: this.tick,
    });
    if (this.events.length > 200) this.events.pop();
  }

  // ---------------------------------------------------------------- orders
  private maybeGenerateOrders(speed: number) {
    const interval = Math.max(1, Math.floor(this.orderInterval / Math.max(0.25, speed)));
    if (this.tick - this.lastOrderTick >= interval) {
      this.createOrder();
      this.lastOrderTick = this.tick;
    }
  }

  private createOrder(): Order | null {
    const restaurants = this.map.restaurants();
    const dropoffs = this.map.dropoffs();
    if (!restaurants.length || !dropoffs.length) return null;
    const r = this.rng.pick(restaurants);
    const c = this.rng.pick(dropoffs);
    const prep = SIM.PREP_MIN_TICKS + this.rng.int(0, SIM.PREP_VAR_TICKS);
    const o: Order = {
      id: `order-${++this.orderSeq}`, traceId: `trace-order-${this.orderSeq}`,
      customerName: this.rng.pick(CUSTOMER_NAMES), restaurantName: r.name,
      restaurantNodeId: r.nodeId, customerNodeId: c.nodeId, status: "CREATED",
      priority: this.rng.int(1, 4), estimatedValue: round2(10 + this.rng.next() * 40),
      createdTick: this.tick, assignedTick: null, deliveredTick: null,
      cookTimeRemaining: prep, mood: "HAPPY", delayed: false, driverId: null,
      batchId: null, batchPosition: null, holdStartTick: null,
    };
    this.orders.set(o.id, o);
    this.totalOrdersGenerated++;
    this.startTrace(o);
    this.addSpan(o, "order-service", "order.created", "OK", o.restaurantName);
    this.emit("ORDER_CREATED", "order", "info", `Order created at ${o.restaurantName}`, o.id);
    this.trim();
    return o;
  }

  // -------------------------------------------------------------- dispatch
  private runDispatch() {
    if (this.strategy === "BATCH_NEARBY" || this.strategy === "BATCH_OPTIMAL") this.runBatch();
    else this.runGreedy();
  }

  private runGreedy() {
    const pending = [...this.orders.values()]
      .filter((o) => o.status === "CREATED" || o.status === "FINDING_DRIVER")
      .sort((a, b) => b.priority - a.priority || a.createdTick - b.createdTick);
    if (!pending.length) return;
    const idle = [...this.drivers.values()].filter((d) => d.status === "IDLE");

    for (const order of pending) {
      if (!idle.length) { if (order.status === "CREATED") order.status = "FINDING_DRIVER"; continue; }
      const attempt = evaluate(this.map, order, idle, this.strategy, this.tick);
      this.pushDispatch(attempt);
      if (attempt.matched) {
        const driver = this.drivers.get(attempt.selectedDriverId!);
        if (driver) { this.assign(driver, order); idle.splice(idle.indexOf(driver), 1); }
      } else if (order.status === "CREATED") order.status = "FINDING_DRIVER";
    }
  }

  private runBatch() {
    for (const o of this.orders.values()) {
      if ((o.status === "CREATED" || o.status === "FINDING_DRIVER") && !this.holdQueue.has(o.id)) {
        o.status = "FINDING_DRIVER";
        o.holdStartTick = this.tick;
        this.holdQueue.set(o.id, o);
      }
    }
    if (!this.holdQueue.size) return;
    const anyReady = [...this.holdQueue.values()].some(
      (o) => this.tick - (o.holdStartTick ?? this.tick) >= SIM.BATCH_HOLD_TICKS
    );
    if (!anyReady) return;
    const idle = [...this.drivers.values()].filter((d) => d.status === "IDLE");
    if (!idle.length) return;

    const held = [...this.holdQueue.values()];
    const plans = evaluateBatch(this.map, held, idle, this.strategy, this.tick);
    for (const plan of plans) {
      const driver = this.drivers.get(plan.driverId);
      if (!driver) continue;
      const batchOrders = plan.orderIds.map((id) => this.orders.get(id)).filter(Boolean) as Order[];
      if (!batchOrders.length) continue;
      this.assignBatch(driver, batchOrders, plan);
      idle.splice(idle.indexOf(driver), 1);
      for (const o of batchOrders) {
        if (o.holdStartTick != null) { this.totalHoldTicks += this.tick - o.holdStartTick; this.holdSamples++; }
        this.holdQueue.delete(o.id);
      }
      this.batchedOrders += batchOrders.length;
      this.batchDispatches++;
      this.sumBatchSavings += plan.savingsPercent;

      const attempt: DispatchAttempt = {
        id: `dsp-batch-${plan.id}`, orderId: plan.orderIds[0],
        restaurantName: batchOrders[0].restaurantName + (batchOrders.length > 1 ? ` +${batchOrders.length - 1} more` : ""),
        strategy: this.strategy, tick: this.tick, matched: true,
        selectedDriverId: driver.id, selectedDriverName: driver.name,
        score: 0, distance: plan.totalDistance, eta: plan.estimatedTime,
        candidatesEvaluated: idle.length + 1, candidates: [],
        reason: `Batch [${this.strategy}] ${batchOrders.length} orders → ${driver.name}, savings ${plan.savingsPercent}%`,
        batchId: plan.id, batchSize: batchOrders.length, batchSavingsPercent: plan.savingsPercent,
      };
      this.pushDispatch(attempt);
    }
  }

  private assign(driver: Driver, order: Order) {
    const path = findPath(this.map, driver.currentNodeId, order.restaurantNodeId);
    if (!path) return;
    driver.status = "EN_ROUTE_PICKUP";
    driver.currentOrderId = order.id;
    driver.route = [...path.nodeIds];
    driver.routeIndex = 0; driver.progress = 0;
    driver.thought = `Heading to ${order.restaurantName}`;
    order.status = "EN_ROUTE_PICKUP";
    order.driverId = driver.id;
    order.assignedTick = this.tick;
    this.addSpan(order, "dispatch-engine", "dispatch.matched", "OK", `${driver.name} (${this.strategy})`);
    this.emit("DISPATCH_MATCHED", "dispatch", "info", `${driver.name} assigned to ${order.restaurantName}`, order.id, driver.id);
  }

  private assignBatch(driver: Driver, batchOrders: Order[], plan: { id: string }) {
    const orderIds = batchOrders.map((o) => o.id);
    const stopNodes = [...batchOrders.map((o) => o.restaurantNodeId), ...batchOrders.map((o) => o.customerNodeId)];
    driver.status = "EN_ROUTE_PICKUP";
    driver.orderBatch = [...orderIds];
    driver.batchId = plan.id;
    driver.batchSize = batchOrders.length;
    driver.batchStopIndex = 0;
    driver.batchStopNodes = stopNodes;
    driver.currentOrderId = orderIds[0];
    driver.thought = `Batch pickup: ${batchOrders.length} orders`;
    this.routeToNextBatchStop(driver);
    batchOrders.forEach((o, i) => {
      o.status = "EN_ROUTE_PICKUP"; o.driverId = driver.id; o.assignedTick = this.tick;
      o.batchId = plan.id; o.batchPosition = i;
      this.addSpan(o, "dispatch-engine", "dispatch.batch-matched", "OK", `${driver.name} [batch pos ${i}]`);
      this.emit("DISPATCH_MATCHED", "dispatch", "info", `${driver.name} batch-assigned to ${o.restaurantName}`, o.id, driver.id);
    });
  }

  private routeToNextBatchStop(driver: Driver) {
    const stops = driver.batchStopNodes;
    if (driver.batchStopIndex >= stops.length) return;
    const target = stops[driver.batchStopIndex];
    const path = findPath(this.map, driver.currentNodeId, target);
    driver.route = path ? [...path.nodeIds] : [driver.currentNodeId, target];
    driver.routeIndex = 0; driver.progress = 0;
  }

  // ------------------------------------------------------------ cook / food
  private updateCookTimers(speed: number) {
    for (const o of this.orders.values()) {
      if (o.cookTimeRemaining > 0 && o.status !== "DELIVERED") {
        o.cookTimeRemaining = Math.max(0, o.cookTimeRemaining - speed);
      }
    }
  }

  private checkFoodReady() {
    for (const d of this.drivers.values()) {
      if (d.status !== "WAITING_AT_RESTAURANT") continue;
      if (d.orderBatch.length) {
        const idx = d.batchStopIndex;
        if (idx < d.orderBatch.length) {
          const order = this.orders.get(d.orderBatch[idx]);
          if (order && order.cookTimeRemaining <= 0) {
            order.status = "EN_ROUTE_DELIVERY";
            this.addSpan(order, "restaurant", "food.ready", "OK", order.restaurantName);
            this.emit("PICKED_UP", "order", "info", `Picked up (batch) from ${order.restaurantName}`, order.id, d.id);
            d.batchStopIndex = idx + 1;
            const pickups = d.orderBatch.length;
            d.status = idx + 1 >= pickups ? "DELIVERING" : "EN_ROUTE_PICKUP";
            d.thought = idx + 1 >= pickups ? `Delivering ${pickups} orders` : `Picking up ${idx + 2}/${pickups}`;
            this.routeToNextBatchStop(d);
          }
        }
        continue;
      }
      const order = d.currentOrderId ? this.orders.get(d.currentOrderId) : null;
      if (!order) { d.status = "IDLE"; d.currentOrderId = null; d.thought = null; continue; }
      if (order.cookTimeRemaining <= 0) this.startDelivery(d, order);
    }
  }

  // ------------------------------------------------------------- movement
  private moveDriver(driver: Driver, speed: number) {
    if (driver.status === "ON_BREAK") {
      if (driver.breakUntilTick != null && this.tick >= driver.breakUntilTick) {
        driver.status = "IDLE"; driver.fatigue = 0; driver.breakUntilTick = null; driver.thought = null;
      }
      driver.targetNodeId = null; return;
    }
    if (driver.status === "IDLE" || driver.status === "OFFLINE" || driver.status === "WAITING_AT_RESTAURANT") {
      driver.speed = 0; driver.targetNodeId = null; return;
    }
    const route = driver.route;
    if (!route || route.length < 2 || driver.routeIndex >= route.length - 1) {
      driver.targetNodeId = null; this.handleArrival(driver); return;
    }
    const current = route[driver.routeIndex];
    const target = route[driver.routeIndex + 1];
    const edgeDist = Math.max(1, this.map.distanceBetween(current, target));
    const step = (driver.vehicleType === "CAR" ? SIM.CAR_STEP : SIM.BIKE_STEP) * speed;
    driver.speed = round1(step);
    let progress = driver.progress + step / edgeDist;
    const prevIndex = driver.routeIndex;
    while (progress >= 1 && driver.routeIndex < route.length - 1) {
      progress -= 1; driver.routeIndex++; driver.currentNodeId = route[driver.routeIndex];
    }
    if (driver.routeIndex > prevIndex) {
      for (let ei = prevIndex; ei < driver.routeIndex && ei + 1 < route.length; ei++) {
        this.totalFleetMiles += this.map.distanceBetween(route[ei], route[ei + 1]);
      }
      driver.totalMiles += this.map.distanceBetween(route[prevIndex], route[driver.routeIndex]);
    }
    driver.progress = Math.min(progress, 0.999);
    if (driver.routeIndex >= route.length - 1) {
      driver.progress = 0; driver.targetNodeId = null; this.handleArrival(driver);
    } else driver.targetNodeId = route[driver.routeIndex + 1];
  }

  private handleArrival(driver: Driver) {
    if (driver.orderBatch.length) { this.handleBatchArrival(driver); return; }
    const order = driver.currentOrderId ? this.orders.get(driver.currentOrderId) : null;
    if (!order) { driver.status = "IDLE"; driver.currentOrderId = null; return; }
    if (driver.status === "EN_ROUTE_PICKUP") {
      driver.currentNodeId = order.restaurantNodeId;
      this.addSpan(order, "driver-runtime", "pickup.arrived", "OK", driver.name);
      if (order.cookTimeRemaining > 0) {
        driver.status = "WAITING_AT_RESTAURANT"; driver.thought = "Waiting for food";
        order.status = "WAITING_FOR_FOOD";
      } else this.startDelivery(driver, order);
    } else if (driver.status === "DELIVERING") this.completeDelivery(driver, order);
  }

  private handleBatchArrival(driver: Driver) {
    const batch = driver.orderBatch;
    const stopIdx = driver.batchStopIndex;
    const pickups = batch.length;
    if (stopIdx < pickups) {
      const order = this.orders.get(batch[stopIdx]);
      if (order) {
        driver.currentNodeId = order.restaurantNodeId;
        this.addSpan(order, "driver-runtime", "pickup.arrived", "OK", driver.name);
        if (order.cookTimeRemaining > 0) {
          order.status = "WAITING_FOR_FOOD"; driver.status = "WAITING_AT_RESTAURANT";
          driver.thought = `Waiting for food (${stopIdx + 1}/${pickups})`; return;
        }
        order.status = "EN_ROUTE_DELIVERY";
        this.addSpan(order, "restaurant", "food.ready", "OK", order.restaurantName);
        this.emit("PICKED_UP", "order", "info", `Picked up (batch ${stopIdx + 1}/${pickups})`, order.id, driver.id);
      }
      driver.batchStopIndex = stopIdx + 1;
      driver.status = stopIdx + 1 >= pickups ? "DELIVERING" : "EN_ROUTE_PICKUP";
      driver.thought = stopIdx + 1 >= pickups ? `Delivering ${pickups} orders` : `Picking up ${stopIdx + 2}/${pickups}`;
      this.routeToNextBatchStop(driver);
    } else {
      const dropIdx = stopIdx - pickups;
      if (dropIdx < batch.length) {
        const order = this.orders.get(batch[dropIdx]);
        if (order) this.completeDelivery(driver, order, true);
        driver.batchStopIndex = stopIdx + 1;
      }
      if (driver.batchStopIndex >= 2 * pickups) {
        driver.orderBatch = []; driver.batchId = null; driver.batchSize = 0;
        driver.batchStopIndex = 0; driver.batchStopNodes = []; driver.currentOrderId = null;
        driver.fatigue += SIM.FATIGUE_PER_DELIVERY * pickups;
        this.finishOrBreak(driver);
      } else { driver.thought = `Dropping off ${dropIdx + 2}/${pickups}`; this.routeToNextBatchStop(driver); }
    }
  }

  private startDelivery(driver: Driver, order: Order) {
    const path = findPath(this.map, order.restaurantNodeId, order.customerNodeId);
    if (!path) return;
    driver.status = "DELIVERING";
    driver.route = [...path.nodeIds]; driver.routeIndex = 0; driver.progress = 0;
    driver.currentNodeId = order.restaurantNodeId;
    driver.thought = `Delivering to ${order.customerName}`;
    order.status = "EN_ROUTE_DELIVERY";
    this.addSpan(order, "driver-runtime", "delivery.enroute", "IN_PROGRESS", driver.name);
    this.emit("PICKED_UP", "order", "info", `Picked up from ${order.restaurantName}`, order.id, driver.id);
  }

  private completeDelivery(driver: Driver, order: Order, batch = false) {
    driver.currentNodeId = order.customerNodeId;
    order.status = "DELIVERED";
    order.deliveredTick = this.tick;
    this.deliveryTicks.unshift(this.tick - order.createdTick);
    if (this.deliveryTicks.length > 300) this.deliveryTicks.pop();
    this.totalDeliveries++;
    driver.totalDeliveries++; driver.experience++;
    this.addSpan(order, "driver-runtime", "delivered", "OK",
      `${round1((this.tick - order.createdTick) * SIM.SECONDS_PER_TICK)}s total${batch ? " (batch)" : ""}`);
    this.emit("DELIVERED", "order", "info", `Delivered to ${order.customerName}`, order.id, driver.id);
    if (!batch) {
      driver.currentOrderId = null; driver.route = []; driver.routeIndex = 0; driver.progress = 0;
      driver.fatigue += SIM.FATIGUE_PER_DELIVERY; driver.thought = null;
      this.finishOrBreak(driver);
    }
  }

  private finishOrBreak(driver: Driver) {
    if (driver.fatigue >= SIM.FATIGUE_BREAK_THRESHOLD) {
      driver.status = "ON_BREAK"; driver.breakUntilTick = this.tick + SIM.BREAK_TICKS; driver.thought = "Taking a break";
      this.emit("DRIVER_BREAK", "driver", "info", `${driver.name} resting (fatigue)`, null, driver.id);
    } else { driver.status = "IDLE"; driver.thought = null; }
  }

  private updateMoods() {
    for (const o of this.orders.values()) {
      if (o.status === "DELIVERED") continue;
      const age = this.tick - o.createdTick;
      o.mood = age < 30 ? "HAPPY" : age < 60 ? "WAITING" : age < SIM.DELAYED_AGE_TICKS ? "FRUSTRATED" : "ANGRY";
      if (age > SIM.DELAYED_AGE_TICKS && !o.delayed) {
        o.delayed = true;
        this.emit("ORDER_DELAYED", "order", "warning", `Order delayed past SLA`, o.id, o.driverId);
      }
    }
  }

  // ------------------------------------------------------------- incidents
  private maybeSpawnIncident() {
    if (this.tick % SIM.INCIDENT_CHECK_TICKS !== 0) return;
    if (this.rng.next() > SIM.INCIDENT_CHANCE) return;
    if (this.incidents.size >= 1) return;
    this.spawnIncident(this.rng.pick(INCIDENT_TYPES));
  }

  spawnIncident(type: IncidentType): Incident {
    const id = `inc-${++this.incidentSeq}`;
    const base: Incident = {
      id, type, severity: "SEV-3", title: "", message: "", zone: "",
      startTick: this.tick, durationTicks: 30, resolved: false, mitigated: false,
      affectedEdgeId: null, affectedDriverId: null,
    };
    switch (type) {
      case "TRAFFIC_JAM": {
        const e = this.randomMajorEdge();
        Object.assign(base, { severity: "SEV-3", title: "Traffic congestion", message: "Heavy traffic on a major arterial", affectedEdgeId: e.id, zone: this.map.zoneForNode(e.from), durationTicks: 30 + this.rng.int(0, 20) });
        this.map.setEdgeMultiplier(e.id, 3.0); this.rerouteAffected(e.id); break;
      }
      case "ACCIDENT": {
        const e = this.rng.pick(this.map.edges);
        Object.assign(base, { severity: "SEV-2", title: "Road accident", message: "Accident blocking a road segment", affectedEdgeId: e.id, zone: this.map.zoneForNode(e.from), durationTicks: 40 + this.rng.int(0, 20) });
        this.map.setEdgeMultiplier(e.id, 6.0); this.rerouteAffected(e.id); break;
      }
      case "RESTAURANT_DELAY": {
        const r = this.rng.pick(this.map.restaurants());
        Object.assign(base, { severity: "SEV-3", title: "Kitchen backlog", message: `${r.name} is running slow`, zone: r.zone, durationTicks: 30 + this.rng.int(0, 15) });
        for (const o of this.orders.values()) {
          if (o.status !== "DELIVERED" && o.restaurantNodeId === r.nodeId) o.cookTimeRemaining += 8;
        }
        break;
      }
      case "DEMAND_SPIKE": {
        const z = this.rng.pick(this.map.zones);
        Object.assign(base, { severity: "SEV-2", title: "Demand surge", message: `Order spike in ${z.name}`, zone: z.name, durationTicks: 20 + this.rng.int(0, 10) });
        const extra = 3 + this.rng.int(0, 3);
        for (let i = 0; i < extra; i++) this.createOrder();
        break;
      }
      case "DRIVER_OFFLINE": {
        const active = [...this.drivers.values()].find((d) => d.status === "EN_ROUTE_PICKUP" || d.status === "DELIVERING");
        Object.assign(base, { severity: "SEV-1", title: "Driver dropped offline", durationTicks: 20 + this.rng.int(0, 10) });
        if (active) {
          base.message = `${active.name} went offline mid-delivery`; base.affectedDriverId = active.id;
          const o = active.currentOrderId ? this.orders.get(active.currentOrderId) : null;
          active.status = "OFFLINE"; active.currentOrderId = null; active.route = [];
          if (o && o.status !== "DELIVERED") { o.status = "FINDING_DRIVER"; o.driverId = null; }
        } else base.message = "Driver connectivity issue detected";
        break;
      }
    }
    this.incidents.set(id, base);
    this.emit("INCIDENT_OPENED", "incident", base.severity === "SEV-1" ? "critical" : "warning", `${base.severity} ${base.title} — ${base.message}`, null, base.affectedDriverId);
    return base;
  }

  private decayIncidents() {
    for (const inc of this.incidents.values()) {
      if (!inc.resolved && this.tick >= inc.startTick + inc.durationTicks) this.resolveIncidentInternal(inc, "auto-resolved");
    }
    for (const [k, inc] of this.incidents) {
      if (inc.resolved && this.tick > inc.startTick + inc.durationTicks + 10) this.incidents.delete(k);
    }
  }

  private resolveIncidentInternal(inc: Incident, note: string) {
    if (inc.affectedEdgeId) this.map.clearEdgeMultiplier(inc.affectedEdgeId);
    if (inc.type === "DRIVER_OFFLINE" && inc.affectedDriverId) {
      const d = this.drivers.get(inc.affectedDriverId);
      if (d && d.status === "OFFLINE") d.status = "IDLE";
    }
    inc.resolved = true; inc.mitigated = inc.mitigated || false;
    this.emit("INCIDENT_RESOLVED", "incident", "info", `${inc.title} resolved (${note})`);
  }

  private rerouteAffected(edgeId: string) {
    const edge = this.map.edge(edgeId);
    if (!edge) return;
    for (const d of this.drivers.values()) {
      if (d.status !== "EN_ROUTE_PICKUP" && d.status !== "DELIVERING") continue;
      if (!this.routeHasEdge(d.route, edge.from, edge.to)) continue;
      const o = d.currentOrderId ? this.orders.get(d.currentOrderId) : null;
      if (!o) continue;
      const target = d.status === "EN_ROUTE_PICKUP" ? o.restaurantNodeId : o.customerNodeId;
      const path = findPath(this.map, d.currentNodeId, target);
      if (path && path.nodeIds.length >= 2) {
        d.route = [...path.nodeIds]; d.routeIndex = 0; d.progress = 0; d.thought = "Rerouting…";
        this.emit("REROUTE", "driver", "warning", `${d.name} rerouted around incident`, o.id, d.id);
      }
    }
  }

  private routeHasEdge(route: string[], from: string, to: string): boolean {
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      if ((a === from && b === to) || (a === to && b === from)) return true;
    }
    return false;
  }

  private randomMajorEdge() {
    const major = this.map.edges.filter((e) => e.isMajor);
    return major.length ? this.rng.pick(major) : this.rng.pick(this.map.edges);
  }

  // ---------------------------------------------------------------- traces
  private startTrace(o: Order) {
    this.traces.set(o.id, { traceId: o.traceId, orderId: o.id, startTick: this.tick, currentStatus: o.status, spans: [] });
  }
  private addSpan(o: Order, service: string, operation: string, status: string, detail: string) {
    const t = this.traces.get(o.id);
    if (!t) return;
    t.spans.push({
      spanId: `span-${t.spans.length}`, service, operation,
      startOffsetTicks: this.tick - t.startTick, durationTicks: 1, status, detail,
    });
    t.currentStatus = o.status;
  }

  private trim() {
    if (this.orders.size > 400) {
      const delivered = [...this.orders.values()].filter((o) => o.status === "DELIVERED")
        .sort((a, b) => (a.deliveredTick ?? 0) - (b.deliveredTick ?? 0));
      const toRemove = this.orders.size - 400;
      for (let i = 0; i < toRemove && i < delivered.length; i++) this.orders.delete(delivered[i].id);
    }
    while (this.traces.size > SIM.TRACE_CAP) {
      const first = this.traces.keys().next().value;
      if (first === undefined) break;
      this.traces.delete(first);
    }
  }

  private pushDispatch(a: DispatchAttempt) {
    this.recentDispatch.unshift(a);
    if (this.recentDispatch.length > SIM.RECENT_DISPATCH_CAP) this.recentDispatch.pop();
  }

  // ----------------------------------------------------------- lifecycle ctl
  reset() {
    this.orders.clear(); this.traces.clear(); this.recentDispatch = []; this.events = [];
    this.deliveryTicks = []; this.incidents.clear(); this.holdQueue.clear();
    this.tick = 0; this.lastOrderTick = 0; this.totalOrdersGenerated = 0; this.totalDeliveries = 0;
    this.orderSeq = 0; this.incidentSeq = 0; this.eventSeq = 0; this.totalFleetMiles = 0;
    this.batchedOrders = 0; this.batchDispatches = 0; this.totalHoldTicks = 0; this.holdSamples = 0;
    this.sumBatchSavings = 0;
    for (const d of this.drivers.values()) {
      Object.assign(d, {
        status: "IDLE", currentOrderId: null, route: [], routeIndex: 0, progress: 0, fatigue: 0,
        thought: null, breakUntilTick: null, orderBatch: [], batchStopNodes: [], batchId: null,
        batchSize: 0, batchStopIndex: 0,
      });
    }
  }

  setStrategy(s: DispatchStrategy) { this.strategy = s; }

  // ------------------------------------------------------- operator actions
  deployDriver(type: VehicleType): Driver {
    const d = this.newDriver(type, this.map.nodes.map((n) => n.id));
    this.drivers.set(d.id, d);
    this.emit("DRIVER_DEPLOYED", "driver", "info", `Deployed ${type} driver ${d.name}`, null, d.id);
    return d;
  }

  cancelOrder(id: string): boolean {
    const o = this.orders.get(id);
    if (!o || o.status === "DELIVERED") return false;
    if (o.driverId) {
      const d = this.drivers.get(o.driverId);
      if (d && !d.orderBatch.length) { d.status = "IDLE"; d.currentOrderId = null; d.route = []; }
    }
    this.orders.delete(id);
    this.holdQueue.delete(id);
    this.emit("ORDER_CANCELLED", "order", "warning", `Order ${id} cancelled by operator`, id);
    return true;
  }

  boostPriority(id: string): boolean {
    const o = this.orders.get(id);
    if (!o) return false;
    o.priority = Math.min(5, o.priority + 1);
    this.emit("ORDER_PRIORITY", "order", "info", `Priority boosted to ${o.priority}`, id);
    return true;
  }

  mitigateIncident(id: string): boolean {
    const inc = this.incidents.get(id);
    if (!inc || inc.resolved) return false;
    if (inc.affectedEdgeId) this.map.setEdgeMultiplier(inc.affectedEdgeId, 1.5);
    inc.mitigated = true;
    inc.durationTicks = Math.min(inc.durationTicks, this.tick - inc.startTick + 6);
    this.emit("INCIDENT_MITIGATED", "incident", "info", `${inc.title} mitigated by operator`);
    return true;
  }

  resolveIncident(id: string): boolean {
    const inc = this.incidents.get(id);
    if (!inc || inc.resolved) return false;
    this.resolveIncidentInternal(inc, "operator resolved");
    return true;
  }

  rushDelayed(): number {
    let n = 0;
    for (const o of this.orders.values()) {
      if (o.status !== "DELIVERED" && o.delayed) { o.priority = 5; n++; }
    }
    this.emit("RUSH_DELAYED", "system", "info", `Operator rushed ${n} delayed orders`);
    return n;
  }

  // --------------------------------------------------------------- read APIs
  private percentiles() {
    const sorted = [...this.deliveryTicks].sort((a, b) => a - b);
    const pct = (p: number) => sorted.length ? sorted[Math.max(0, Math.floor(sorted.length * p) - 1)] * SIM.SECONDS_PER_TICK : 0;
    const avg = sorted.length ? (sorted.reduce((s, v) => s + v, 0) / sorted.length) * SIM.SECONDS_PER_TICK : 0;
    return { p50: round1(pct(0.5)), p95: round1(pct(0.95)), p99: round1(pct(0.99)), avg: round1(avg) };
  }

  metrics(): Metrics {
    const drivers = [...this.drivers.values()];
    const orders = [...this.orders.values()];
    const active = drivers.filter((d) => d.status === "EN_ROUTE_PICKUP" || d.status === "DELIVERING" || d.status === "WAITING_AT_RESTAURANT").length;
    const idle = drivers.filter((d) => d.status === "IDLE").length;
    const pending = orders.filter((o) => o.status === "CREATED" || o.status === "FINDING_DRIVER").length;
    const inProgress = orders.filter((o) => o.status === "EN_ROUTE_PICKUP" || o.status === "WAITING_FOR_FOOD" || o.status === "EN_ROUTE_DELIVERY").length;
    const delayed = orders.filter((o) => o.delayed && o.status !== "DELIVERED").length;
    const { p50, p95, p99, avg } = this.percentiles();
    const revenue = orders.filter((o) => o.status === "DELIVERED").reduce((s, o) => s + o.estimatedValue, 0);
    const windowStart = this.tick - Math.round(60 / SIM.SECONDS_PER_TICK);
    const opm = orders.filter((o) => o.createdTick >= windowStart).length;
    const health: Metrics["networkHealth"] = pending > 12 || delayed > 5 ? "critical" : pending > 5 ? "busy" : "stable";
    return {
      totalDrivers: drivers.length, activeDrivers: active, idleDrivers: idle,
      pendingOrders: pending, inProgressOrders: inProgress, completedDeliveries: this.totalDeliveries,
      delayedOrders: delayed, driverUtilization: drivers.length ? round1((active / drivers.length) * 100) : 0,
      ordersPerMinute: opm, avgEta: p50, revenue: round2(revenue),
      customerSatisfaction: round1(Math.max(0, 100 - delayed * 5)),
      networkHealth: health, totalFleetMiles: round1(this.totalFleetMiles),
      milesPerDelivery: this.totalDeliveries ? round2(this.totalFleetMiles / this.totalDeliveries) : 0,
      batchedOrders: this.batchedOrders,
      avgBatchSize: this.batchDispatches ? round1(this.batchedOrders / this.batchDispatches) : 0,
      holdTimeAvgSec: this.holdSamples ? round1((this.totalHoldTicks / this.holdSamples) * SIM.SECONDS_PER_TICK) : 0,
      p50, p95, p99,
    };
  }

  private queues(): QueueMetric[] {
    const m = this.metrics();
    const health = (d: number, hi: number) => (d > hi ? "critical" : d > hi / 2 ? "busy" : "healthy");
    return [
      { name: "order-intake", depth: m.pendingOrders, workers: 4, throughput: m.ordersPerMinute, health: health(m.pendingOrders, 12) },
      { name: "dispatch-solver", depth: this.holdQueue.size, workers: 2, throughput: this.recentDispatch.length, health: health(this.holdQueue.size, 8) },
      { name: "delivery-runtime", depth: m.inProgressOrders, workers: m.activeDrivers, throughput: m.completedDeliveries, health: health(m.inProgressOrders, 20) },
    ];
  }

  snapshot(running: boolean, speed: number): Snapshot {
    return {
      tick: this.tick, running, speed, strategy: this.strategy,
      drivers: [...this.drivers.values()],
      orders: [...this.orders.values()].filter((o) => o.status !== "DELIVERED").concat(
        [...this.orders.values()].filter((o) => o.status === "DELIVERED").slice(-20)
      ),
      incidents: [...this.incidents.values()].filter((i) => !i.resolved),
      dispatch: this.recentDispatch.slice(0, 20),
      events: this.events.slice(0, 40),
      queues: this.queues(),
      metrics: this.metrics(),
    };
  }

  // getters for experiments / server
  driverList() { return [...this.drivers.values()]; }
  orderList() { return [...this.orders.values()]; }
  incidentList() { return [...this.incidents.values()]; }
  recentDispatchList() { return [...this.recentDispatch]; }
  traceFor(orderId: string) { return this.traces.get(orderId) ?? null; }
  get generated() { return this.totalOrdersGenerated; }
  get delivered() { return this.totalDeliveries; }
  get fleetMiles() { return this.totalFleetMiles; }
  get batched() { return this.batchedOrders; }
  get batchDispatchCount() { return this.batchDispatches; }
  get holdTicksTotal() { return this.totalHoldTicks; }
  get holdSampleCount() { return this.holdSamples; }
  get avgBatchSavings() { return this.batchDispatches ? this.sumBatchSavings / this.batchDispatches : 0; }
  deliveryDurationTicks() { return [...this.deliveryTicks]; }
}
