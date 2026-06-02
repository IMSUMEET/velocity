package com.velocity.engine;

import com.velocity.map.CityMap;
import com.velocity.map.MapModels.MapBuilding;
import com.velocity.map.MapModels.MapEdge;
import com.velocity.map.Pathfinding;
import com.velocity.model.*;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.model.enums.DriverStatus;
import com.velocity.model.enums.IncidentType;
import com.velocity.model.enums.OrderStatus;
import com.velocity.model.enums.VehicleType;
import com.velocity.service.EventService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Authoritative in-memory simulation of the delivery marketplace. Owns drivers,
 * orders, incidents, dispatch attempts, traces, and queue/metric derivation.
 * One {@link #tick(double)} advances the whole world; all mutating and reading
 * access is guarded by a single lock so REST actions stay consistent with the
 * scheduled tick.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SimulationEngine {

    private static final String[] DRIVER_NAMES = {
            "Maya Chen", "Kai Rivera", "Jordan Lee", "Sam Patel", "Riley Kim", "Alex Nguyen",
            "Morgan Cruz", "Taylor Brooks", "Quinn Davis", "Drew Martin", "Avery Santos",
            "Blake Wilson", "Casey Thompson", "Jamie Reyes", "Logan Park", "Peyton Hall",
            "Devin Shah", "Noa Klein", "Iris Wong", "Theo Ramirez"
    };
    private static final String[] CUSTOMER_NAMES = {
            "Emma S.", "Liam T.", "Olivia R.", "Noah B.", "Ava M.", "Ethan W.", "Sophia K.",
            "Mason J.", "Isabella F.", "William D.", "Mia L.", "James H.", "Harper G.",
            "Lucas N.", "Ella P.", "Jack C."
    };

    private static final int INITIAL_DRIVERS = 5;
    private static final int ORDER_GEN_BASE_TICKS = 7;
    private static final double CAR_STEP = 26.0;
    private static final double BIKE_STEP = 20.0;
    private static final int PREP_MIN_TICKS = 5;
    private static final int PREP_VAR_TICKS = 9;
    private static final double FATIGUE_PER_DELIVERY = 14;
    private static final double FATIGUE_BREAK_THRESHOLD = 80;
    private static final int BREAK_TICKS = 16;
    private static final long DELAYED_AGE_MS = 45_000;
    private static final int INCIDENT_CHECK_TICKS = 50;
    private static final double INCIDENT_CHANCE = 0.4;
    private static final int RECENT_DISPATCH_CAP = 60;
    private static final int TRACE_CAP = 150;
    private static final int BATCH_HOLD_TICKS = 5;

    private final CityMap cityMap;
    private final Pathfinding pathfinding;
    private final DispatchEngine dispatchEngine;
    private final EventService eventService;

    private final Object lock = new Object();

    private final Map<String, DriverState> drivers = new LinkedHashMap<>();
    private final Map<String, OrderState> orders = new LinkedHashMap<>();
    private final Map<String, Incident> incidents = new ConcurrentHashMap<>();
    private final Map<String, OrderTrace> traces = new LinkedHashMap<>();
    private final Deque<DispatchAttempt> recentDispatch = new ArrayDeque<>();
    private final Deque<Double> deliveryDurations = new ArrayDeque<>();
    /** Orders held in the batch queue, waiting for the hold window to expire. */
    private final Map<String, OrderState> holdQueue = new LinkedHashMap<>();
    private final Map<String, Long> holdStartTick = new HashMap<>();

    private long tickCount = 0;
    private long lastOrderTick = 0;
    private int totalOrdersGenerated = 0;
    private int totalDeliveries = 0;
    private int orderSeq = 0;
    private int driverSeq = 0;
    private int incidentSeq = 0;
    private long startTimeMs = System.currentTimeMillis();
    private volatile DispatchStrategy strategy = DispatchStrategy.BALANCED;
    private double lastOrdersPerMinute = 0;
    private long ordersInWindow = 0;
    private double totalFleetMiles = 0;
    private int batchedOrders = 0;
    private double totalHoldTimeMs = 0;
    private int holdTimeSamples = 0;

    @PostConstruct
    public void seed() {
        seedWithRandom(null);
    }

    /** Seeds (or re-seeds) the driver pool with a specific RNG for reproducible experiments. */
    public void seedWithRandom(Random rng) {
        synchronized (lock) {
            drivers.clear();
            driverSeq = 0;
            List<String> nodeIds = cityMap.getNodes().stream().map(n -> n.id()).toList();
            VehicleType[] fixedTypes = { VehicleType.CAR, VehicleType.BIKE, VehicleType.CAR, VehicleType.BIKE, VehicleType.CAR };
            for (int i = 0; i < INITIAL_DRIVERS; i++) {
                VehicleType type = fixedTypes[i % fixedTypes.length];
                DriverState d = newDriver(type, nodeIds, rng);
                d.setName(DRIVER_NAMES[i % DRIVER_NAMES.length]);
                drivers.put(d.getId(), d);
            }
            log.info("Seeded {} drivers", drivers.size());
        }
    }

    private DriverState newDriver(VehicleType type, List<String> nodeIds, Random rng) {
        Random r = rng != null ? rng : ThreadLocalRandom.current();
        DriverState d = new DriverState();
        d.setId("driver-" + (++driverSeq));
        d.setName(DRIVER_NAMES[r.nextInt(DRIVER_NAMES.length)]);
        d.setVehicleType(type);
        d.setStatus(DriverStatus.IDLE);
        d.setCurrentNodeId(nodeIds.get(r.nextInt(nodeIds.size())));
        d.setProgress(0);
        d.setRoute(new ArrayList<>());
        d.setRouteIndex(0);
        d.setSpeed(0);
        d.setRating(Math.round((3.5 + r.nextDouble() * 1.5) * 10) / 10.0);
        return d;
    }

    // ---------------------------------------------------------------- tick

    public void tick(double speedMultiplier) {
        synchronized (lock) {
            tickCount++;
            decayIncidents();
            updateCookTimers(speedMultiplier);
            checkFoodReady();
            for (DriverState d : drivers.values()) {
                try {
                    moveDriver(d, speedMultiplier);
                } catch (Exception e) {
                    log.warn("move error for {}", d.getId(), e);
                }
            }
            maybeGenerateOrders(speedMultiplier);
            runDispatch();
            updateMoodsAndDelays();
            maybeSpawnIncident();
        }
    }

    private void maybeGenerateOrders(double speedMultiplier) {
        long interval = Math.max(1, (long) (ORDER_GEN_BASE_TICKS / Math.max(0.25, speedMultiplier)));
        if (tickCount - lastOrderTick >= interval) {
            createOrder();
            lastOrderTick = tickCount;
        }
    }

    private OrderState createOrder() {
        List<MapBuilding> restaurants = cityMap.restaurants();
        List<MapBuilding> dropoffs = cityMap.dropoffs();
        if (restaurants.isEmpty() || dropoffs.isEmpty()) return null;
        MapBuilding restaurant = restaurants.get(ThreadLocalRandom.current().nextInt(restaurants.size()));
        MapBuilding dropoff = dropoffs.get(ThreadLocalRandom.current().nextInt(dropoffs.size()));

        OrderState o = new OrderState();
        o.setId("order-" + (++orderSeq));
        o.setTraceId("trace-" + o.getId());
        o.setCustomerName(CUSTOMER_NAMES[ThreadLocalRandom.current().nextInt(CUSTOMER_NAMES.length)]);
        o.setRestaurantName(restaurant.name());
        o.setRestaurantNodeId(restaurant.nodeId());
        o.setCustomerNodeId(dropoff.nodeId());
        o.setStatus(OrderStatus.CREATED);
        o.setPriority(ThreadLocalRandom.current().nextInt(1, 4));
        o.setEstimatedValue(Math.round((10 + ThreadLocalRandom.current().nextDouble() * 40) * 100) / 100.0);
        o.setCreatedAt(System.currentTimeMillis());
        o.setMood("HAPPY");
        double prep = PREP_MIN_TICKS + ThreadLocalRandom.current().nextInt(PREP_VAR_TICKS);
        o.setCookTimeRemaining(prep);
        o.setEstimatedPrepTime(prep);
        orders.put(o.getId(), o);
        totalOrdersGenerated++;
        ordersInWindow++;

        startTrace(o);
        addSpan(o, "order-service", "order.created", "OK", o.getRestaurantName());
        eventService.record("ORDER_CREATED", "order", "info", o.getId(), null, o.getTraceId(),
                "Order created at " + o.getRestaurantName(), tickCount);
        trimMaps();
        return o;
    }

    private void runDispatch() {
        boolean isBatch = strategy == DispatchStrategy.BATCH_NEARBY || strategy == DispatchStrategy.BATCH_OPTIMAL;
        if (isBatch) {
            runBatchDispatch();
        } else {
            runGreedyDispatch();
        }
    }

    private void runGreedyDispatch() {
        List<OrderState> pending = orders.values().stream()
                .filter(o -> o.getStatus() == OrderStatus.CREATED || o.getStatus() == OrderStatus.FINDING_DRIVER)
                .sorted(Comparator.<OrderState>comparingInt(o -> -o.getPriority())
                        .thenComparingLong(OrderState::getCreatedAt))
                .toList();
        if (pending.isEmpty()) return;

        List<DriverState> idle = drivers.values().stream()
                .filter(d -> d.getStatus() == DriverStatus.IDLE)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

        for (OrderState order : pending) {
            if (idle.isEmpty()) {
                if (order.getStatus() == OrderStatus.CREATED) {
                    order.setStatus(OrderStatus.FINDING_DRIVER);
                }
                continue;
            }
            DispatchAttempt attempt = dispatchEngine.evaluate(order, idle, strategy, System.currentTimeMillis());
            pushDispatch(attempt);
            if (attempt.isMatched()) {
                DriverState driver = drivers.get(attempt.getSelectedDriverId());
                if (driver != null) {
                    assign(driver, order, attempt);
                    idle.remove(driver);
                }
            } else if (order.getStatus() == OrderStatus.CREATED) {
                order.setStatus(OrderStatus.FINDING_DRIVER);
            }
        }
    }

    private void runBatchDispatch() {
        long nowMs = System.currentTimeMillis();

        // Move new CREATED/FINDING_DRIVER orders into hold queue
        for (OrderState o : orders.values()) {
            if ((o.getStatus() == OrderStatus.CREATED || o.getStatus() == OrderStatus.FINDING_DRIVER)
                    && !holdQueue.containsKey(o.getId())) {
                o.setStatus(OrderStatus.FINDING_DRIVER);
                o.setHoldStartMs(nowMs);
                holdQueue.put(o.getId(), o);
                holdStartTick.put(o.getId(), tickCount);
            }
        }

        // Only solve batch when enough hold ticks have accumulated
        if (holdQueue.isEmpty()) return;
        boolean anyReady = holdQueue.keySet().stream()
                .anyMatch(id -> tickCount - holdStartTick.getOrDefault(id, tickCount) >= BATCH_HOLD_TICKS);
        if (!anyReady) return;

        List<DriverState> idle = drivers.values().stream()
                .filter(d -> d.getStatus() == DriverStatus.IDLE)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if (idle.isEmpty()) return;

        List<OrderState> heldList = new ArrayList<>(holdQueue.values());
        List<BatchPlan> plans = dispatchEngine.evaluateBatch(heldList, idle, strategy, nowMs);

        for (BatchPlan plan : plans) {
            DriverState driver = drivers.get(plan.getDriverId());
            if (driver == null) continue;
            List<OrderState> batchOrders = plan.getOrderIds().stream()
                    .map(orders::get).filter(Objects::nonNull).toList();
            if (batchOrders.isEmpty()) continue;

            assignBatch(driver, batchOrders, plan);
            idle.remove(driver);

            // Track hold time stats
            for (OrderState o : batchOrders) {
                if (o.getHoldStartMs() > 0) {
                    totalHoldTimeMs += nowMs - o.getHoldStartMs();
                    holdTimeSamples++;
                }
                holdQueue.remove(o.getId());
                holdStartTick.remove(o.getId());
            }
            batchedOrders += batchOrders.size();

            // Create one DispatchAttempt per batch for the control plane feed
            DispatchAttempt attempt = new DispatchAttempt();
            attempt.setId("dsp-" + UUID.randomUUID().toString().substring(0, 8));
            attempt.setOrderId(plan.getOrderIds().get(0));
            attempt.setRestaurantName(batchOrders.get(0).getRestaurantName()
                    + (batchOrders.size() > 1 ? " +" + (batchOrders.size() - 1) + " more" : ""));
            attempt.setStrategy(strategy);
            attempt.setTimestamp(nowMs);
            attempt.setMatched(true);
            attempt.setSelectedDriverId(driver.getId());
            attempt.setSelectedDriverName(driver.getName());
            attempt.setDistance(plan.getTotalDistance());
            attempt.setEta(plan.getEstimatedTime());
            attempt.setCandidatesEvaluated(idle.size() + 1);
            attempt.setBatchId(plan.getId());
            attempt.setBatchSize(batchOrders.size());
            attempt.setBatchSavingsPercent(plan.getSavingsPercent());
            attempt.setReason(String.format("Batch [%s] %d orders → %s savings %.1f%%",
                    strategy, batchOrders.size(), driver.getName(), plan.getSavingsPercent()));
            pushDispatch(attempt);
        }
    }

    private void assignBatch(DriverState driver, List<OrderState> batchOrders, BatchPlan plan) {
        String batchId = plan.getId();
        List<String> orderIds = batchOrders.stream().map(OrderState::getId).toList();

        // Build ordered stop-node list: [pickup1, pickup2, ..., drop1, drop2, ...]
        List<String> stopNodes = new ArrayList<>();
        for (OrderState o : batchOrders) stopNodes.add(o.getRestaurantNodeId());
        for (OrderState o : batchOrders) stopNodes.add(o.getCustomerNodeId());

        driver.setStatus(DriverStatus.EN_ROUTE_PICKUP);
        driver.setOrderBatch(new ArrayList<>(orderIds));
        driver.setBatchId(batchId);
        driver.setBatchSize(batchOrders.size());
        driver.setBatchStopIndex(0);
        driver.setBatchStopNodes(stopNodes);
        driver.setCurrentOrderId(orderIds.get(0));
        driver.setThoughtMessage("Batch pickup: " + batchOrders.size() + " orders");
        driver.setStatusDetail("Batch dispatch [" + batchId + "]");

        // Route to first stop only (segment-by-segment routing)
        routeToNextBatchStop(driver);

        for (int i = 0; i < batchOrders.size(); i++) {
            OrderState o = batchOrders.get(i);
            o.setStatus(OrderStatus.EN_ROUTE_PICKUP);
            o.setDriverId(driver.getId());
            o.setAssignedAt(System.currentTimeMillis());
            o.setBatchId(batchId);
            o.setBatchPosition(i);
            addSpan(o, "dispatch-engine", "dispatch.batch-matched", "OK",
                    driver.getName() + " [batch " + batchId + " pos " + i + "]");
            eventService.record("DISPATCH_MATCHED", "dispatch", "info", o.getId(), driver.getId(),
                    o.getTraceId(), driver.getName() + " batch-assigned to " + o.getRestaurantName(), tickCount);
        }
    }

    /** Routes the driver to batchStopNodes[batchStopIndex]. */
    private void routeToNextBatchStop(DriverState driver) {
        List<String> stops = driver.getBatchStopNodes();
        int idx = driver.getBatchStopIndex();
        if (idx >= stops.size()) return;
        String target = stops.get(idx);
        Pathfinding.PathResult path = pathfinding.findPath(driver.getCurrentNodeId(), target);
        if (path != null) {
            driver.setRoute(new ArrayList<>(path.nodeIds()));
        } else {
            driver.setRoute(new ArrayList<>(List.of(driver.getCurrentNodeId(), target)));
        }
        driver.setRouteIndex(0);
        driver.setProgress(0);
    }

    private void assign(DriverState driver, OrderState order, DispatchAttempt attempt) {
        Pathfinding.PathResult path = pathfinding.findPath(driver.getCurrentNodeId(), order.getRestaurantNodeId());
        if (path == null) return;
        driver.setStatus(DriverStatus.EN_ROUTE_PICKUP);
        driver.setCurrentOrderId(order.getId());
        driver.setRoute(new ArrayList<>(path.nodeIds()));
        driver.setRouteIndex(0);
        driver.setProgress(0);
        driver.setThoughtMessage("Heading to " + order.getRestaurantName());
        driver.setStatusDetail("Pickup at " + order.getRestaurantName());

        order.setStatus(OrderStatus.EN_ROUTE_PICKUP);
        order.setDriverId(driver.getId());
        order.setAssignedAt(System.currentTimeMillis());

        addSpan(order, "dispatch-engine", "dispatch.matched", "OK",
                driver.getName() + " (" + strategy + ")");
        addSpan(order, "driver-runtime", "pickup.enroute", "IN_PROGRESS", driver.getName());
        eventService.record("DISPATCH_MATCHED", "dispatch", "info", order.getId(), driver.getId(),
                order.getTraceId(), driver.getName() + " assigned to " + order.getRestaurantName(), tickCount);
    }

    private void updateCookTimers(double speedMultiplier) {
        for (OrderState o : orders.values()) {
            if (o.getCookTimeRemaining() != null && o.getCookTimeRemaining() > 0
                    && o.getStatus() != OrderStatus.DELIVERED) {
                o.setCookTimeRemaining(Math.max(0, o.getCookTimeRemaining() - speedMultiplier));
            }
        }
    }

    private void checkFoodReady() {
        for (DriverState d : drivers.values()) {
            if (d.getStatus() != DriverStatus.WAITING_AT_RESTAURANT) continue;

            // Batch driver waiting at a pickup stop
            if (!d.getOrderBatch().isEmpty()) {
                int stopIdx = d.getBatchStopIndex();
                if (stopIdx < d.getOrderBatch().size()) {
                    String orderId = d.getOrderBatch().get(stopIdx);
                    OrderState order = orders.get(orderId);
                    if (order != null && (order.getCookTimeRemaining() == null || order.getCookTimeRemaining() <= 0)) {
                        order.setStatus(OrderStatus.EN_ROUTE_DELIVERY);
                        addSpan(order, "restaurant", "food.ready", "OK", order.getRestaurantName());
                        eventService.record("PICKED_UP", "order", "info", order.getId(), d.getId(),
                                order.getTraceId(), "Picked up (batch) from " + order.getRestaurantName(), tickCount);
                        // Advance to next stop
                        d.setBatchStopIndex(stopIdx + 1);
                        int pickupCount = d.getOrderBatch().size();
                        if (stopIdx + 1 >= pickupCount) {
                            d.setStatus(DriverStatus.DELIVERING);
                            d.setThoughtMessage("Delivering " + pickupCount + " orders");
                        } else {
                            d.setStatus(DriverStatus.EN_ROUTE_PICKUP);
                            d.setThoughtMessage("Picking up " + (stopIdx + 2) + "/" + pickupCount);
                        }
                        routeToNextBatchStop(d);
                    }
                }
                continue;
            }

            // Non-batch driver
            OrderState order = d.getCurrentOrderId() == null ? null : orders.get(d.getCurrentOrderId());
            if (order == null) {
                d.setStatus(DriverStatus.IDLE);
                d.setCurrentOrderId(null);
                d.setThoughtMessage(null);
                d.setStatusDetail(null);
                continue;
            }
            if (order.getCookTimeRemaining() == null || order.getCookTimeRemaining() <= 0) {
                eventService.record("ORDER_FOOD_READY", "order", "info", order.getId(), d.getId(),
                        order.getTraceId(), "Food ready at " + order.getRestaurantName(), tickCount);
                startDelivery(d, order);
            }
        }
    }

    private void moveDriver(DriverState driver, double speedMultiplier) {
        if (driver.getStatus() == DriverStatus.ON_BREAK) {
            if (driver.getBreakUntilTick() != null && tickCount >= driver.getBreakUntilTick()) {
                driver.setStatus(DriverStatus.IDLE);
                driver.setFatigue(0);
                driver.setBreakUntilTick(null);
                driver.setThoughtMessage(null);
                driver.setStatusDetail(null);
            }
            driver.setTargetNodeId(null);
            return;
        }
        if (driver.getReroutingUntilTick() != null && tickCount >= driver.getReroutingUntilTick()) {
            driver.setReroutingUntilTick(null);
        }
        if (driver.getStatus() == DriverStatus.IDLE || driver.getStatus() == DriverStatus.OFFLINE
                || driver.getStatus() == DriverStatus.WAITING_AT_RESTAURANT) {
            driver.setSpeed(0);
            driver.setTargetNodeId(null);
            return;
        }

        List<String> route = driver.getRoute();
        if (route == null || route.size() < 2 || driver.getRouteIndex() >= route.size() - 1) {
            driver.setTargetNodeId(null);
            handleArrival(driver);
            return;
        }

        String current = route.get(driver.getRouteIndex());
        String target = route.get(driver.getRouteIndex() + 1);
        double edgeDist = Math.max(1.0, cityMap.distanceBetween(current, target));
        double step = (driver.getVehicleType() == VehicleType.CAR ? CAR_STEP : BIKE_STEP) * speedMultiplier;
        driver.setSpeed(Math.round(step * 10) / 10.0);
        double delta = step / edgeDist;
        double progress = driver.getProgress() + delta;

        double prevProgress = driver.getProgress();
        int prevIndex = driver.getRouteIndex();

        while (progress >= 1.0 && driver.getRouteIndex() < route.size() - 1) {
            progress -= 1.0;
            driver.setRouteIndex(driver.getRouteIndex() + 1);
            driver.setCurrentNodeId(route.get(driver.getRouteIndex()));
        }

        // Track fleet miles: accumulate actual edge distance covered this tick
        int edgesCrossed = driver.getRouteIndex() - prevIndex;
        if (edgesCrossed > 0) {
            for (int ei = prevIndex; ei < driver.getRouteIndex() && ei + 1 < route.size(); ei++) {
                totalFleetMiles += cityMap.distanceBetween(route.get(ei), route.get(ei + 1));
            }
            driver.setTotalMilesDriven(driver.getTotalMilesDriven()
                    + cityMap.distanceBetween(route.get(prevIndex), route.get(driver.getRouteIndex())));
        }
        driver.setProgress(Math.min(progress, 0.999));

        if (driver.getRouteIndex() >= route.size() - 1) {
            driver.setProgress(0);
            driver.setTargetNodeId(null);
            handleArrival(driver);
        } else {
            driver.setTargetNodeId(route.get(driver.getRouteIndex() + 1));
        }
    }

    private void handleArrival(DriverState driver) {
        // Batch mode: the route covers multiple pickups and drops sequentially.
        // Arrival is detected by reaching the end of the pre-built route.
        if (!driver.getOrderBatch().isEmpty()) {
            handleBatchArrival(driver);
            return;
        }

        OrderState order = driver.getCurrentOrderId() == null ? null : orders.get(driver.getCurrentOrderId());
        if (order == null) {
            driver.setStatus(DriverStatus.IDLE);
            driver.setCurrentOrderId(null);
            return;
        }
        if (driver.getStatus() == DriverStatus.EN_ROUTE_PICKUP) {
            driver.setCurrentNodeId(order.getRestaurantNodeId());
            addSpan(order, "driver-runtime", "pickup.arrived", "OK", driver.getName());
            if (order.getCookTimeRemaining() != null && order.getCookTimeRemaining() > 0) {
                driver.setStatus(DriverStatus.WAITING_AT_RESTAURANT);
                driver.setThoughtMessage("Waiting for food");
                driver.setStatusDetail("Waiting at " + order.getRestaurantName());
                order.setStatus(OrderStatus.WAITING_FOR_FOOD);
                eventService.record("PICKUP_WAIT", "driver", "info", order.getId(), driver.getId(),
                        order.getTraceId(), driver.getName() + " waiting for food", tickCount);
            } else {
                startDelivery(driver, order);
            }
        } else if (driver.getStatus() == DriverStatus.DELIVERING) {
            completeDelivery(driver, order);
        }
    }

    /**
     * Segment-by-segment batch routing. The driver moves to one stop at a time:
     * Phase 1 (stops 0..N-1): pickups.  Phase 2 (stops N..2N-1): deliveries.
     * After each arrival we process the stop, advance batchStopIndex, and route
     * to the next stop — no mega-route, no oscillation.
     */
    private void handleBatchArrival(DriverState driver) {
        List<String> batch = driver.getOrderBatch();
        int stopIdx = driver.getBatchStopIndex();
        int pickupCount = batch.size();

        if (stopIdx < pickupCount) {
            // Pickup phase: arrived at restaurant #stopIdx
            String orderId = batch.get(stopIdx);
            OrderState order = orders.get(orderId);
            if (order != null) {
                driver.setCurrentNodeId(order.getRestaurantNodeId());
                addSpan(order, "driver-runtime", "pickup.arrived", "OK", driver.getName());

                if (order.getCookTimeRemaining() != null && order.getCookTimeRemaining() > 0) {
                    // Food not ready — wait here; checkFoodReady() will resume us
                    order.setStatus(OrderStatus.WAITING_FOR_FOOD);
                    driver.setStatus(DriverStatus.WAITING_AT_RESTAURANT);
                    driver.setThoughtMessage("Waiting for food (" + (stopIdx + 1) + "/" + pickupCount + ")");
                    return; // don't advance yet — resumeBatchAfterWait() will
                }

                order.setStatus(OrderStatus.EN_ROUTE_DELIVERY);
                addSpan(order, "restaurant", "food.ready", "OK", order.getRestaurantName());
                eventService.record("PICKED_UP", "order", "info", order.getId(), driver.getId(),
                        order.getTraceId(), "Picked up (batch " + (stopIdx + 1) + "/" + pickupCount + ")", tickCount);
            }
            driver.setBatchStopIndex(stopIdx + 1);

            if (stopIdx + 1 >= pickupCount) {
                driver.setStatus(DriverStatus.DELIVERING);
                driver.setThoughtMessage("Delivering " + pickupCount + " orders");
            } else {
                driver.setStatus(DriverStatus.EN_ROUTE_PICKUP);
                driver.setThoughtMessage("Picking up " + (stopIdx + 2) + "/" + pickupCount);
            }
            routeToNextBatchStop(driver);

        } else {
            // Delivery phase: drop #(stopIdx - pickupCount)
            int dropIdx = stopIdx - pickupCount;
            if (dropIdx < batch.size()) {
                String orderId = batch.get(dropIdx);
                OrderState order = orders.get(orderId);
                if (order != null) {
                    completeBatchDelivery(driver, order);
                }
                driver.setBatchStopIndex(stopIdx + 1);
            }

            if (driver.getBatchStopIndex() >= 2 * pickupCount) {
                // All done
                driver.setOrderBatch(new ArrayList<>());
                driver.setBatchId(null);
                driver.setBatchSize(0);
                driver.setBatchStopIndex(0);
                driver.setBatchStopNodes(new ArrayList<>());
                driver.setCurrentOrderId(null);
                driver.setFatigue(driver.getFatigue() + FATIGUE_PER_DELIVERY * pickupCount);
                if (driver.getFatigue() >= FATIGUE_BREAK_THRESHOLD) {
                    driver.setStatus(DriverStatus.ON_BREAK);
                    driver.setBreakUntilTick(tickCount + BREAK_TICKS);
                    driver.setThoughtMessage("Taking a break");
                } else {
                    driver.setStatus(DriverStatus.IDLE);
                    driver.setThoughtMessage(null);
                    driver.setStatusDetail(null);
                }
            } else {
                driver.setThoughtMessage("Dropping off " + (dropIdx + 2) + "/" + pickupCount);
                routeToNextBatchStop(driver);
            }
        }
    }

    private void completeBatchDelivery(DriverState driver, OrderState order) {
        driver.setCurrentNodeId(order.getCustomerNodeId());
        order.setStatus(OrderStatus.DELIVERED);
        order.setDeliveredAt(System.currentTimeMillis());
        double durationSec = (order.getDeliveredAt() - order.getCreatedAt()) / 1000.0;
        deliveryDurations.addFirst(durationSec);
        while (deliveryDurations.size() > 200) deliveryDurations.removeLast();
        totalDeliveries++;
        driver.setTotalDeliveries(driver.getTotalDeliveries() + 1);
        driver.setExperience(driver.getExperience() + 1);
        addSpan(order, "driver-runtime", "delivered", "OK",
                String.format("%.0fs total (batch)", durationSec));
        eventService.record("DELIVERED", "order", "info", order.getId(), driver.getId(),
                order.getTraceId(), "Delivered (batch) to " + order.getCustomerName(), tickCount);
    }

    private void startDelivery(DriverState driver, OrderState order) {
        Pathfinding.PathResult path = pathfinding.findPath(order.getRestaurantNodeId(), order.getCustomerNodeId());
        if (path == null) return;
        driver.setStatus(DriverStatus.DELIVERING);
        driver.setRoute(new ArrayList<>(path.nodeIds()));
        driver.setRouteIndex(0);
        driver.setProgress(0);
        driver.setCurrentNodeId(order.getRestaurantNodeId());
        driver.setThoughtMessage("Delivering to " + order.getCustomerName());
        driver.setStatusDetail("Delivering to " + order.getCustomerName());
        order.setStatus(OrderStatus.EN_ROUTE_DELIVERY);
        addSpan(order, "restaurant", "food.ready", "OK", order.getRestaurantName());
        addSpan(order, "driver-runtime", "delivery.enroute", "IN_PROGRESS", driver.getName());
        eventService.record("PICKED_UP", "order", "info", order.getId(), driver.getId(),
                order.getTraceId(), "Picked up from " + order.getRestaurantName(), tickCount);
    }

    private void completeDelivery(DriverState driver, OrderState order) {
        driver.setCurrentNodeId(order.getCustomerNodeId());
        order.setStatus(OrderStatus.DELIVERED);
        order.setDeliveredAt(System.currentTimeMillis());
        double durationSec = (order.getDeliveredAt() - order.getCreatedAt()) / 1000.0;
        deliveryDurations.addFirst(durationSec);
        while (deliveryDurations.size() > 200) deliveryDurations.removeLast();
        totalDeliveries++;

        driver.setCurrentOrderId(null);
        driver.setRoute(new ArrayList<>());
        driver.setRouteIndex(0);
        driver.setProgress(0);
        driver.setTotalDeliveries(driver.getTotalDeliveries() + 1);
        driver.setExperience(driver.getExperience() + 1);
        driver.setFatigue(driver.getFatigue() + FATIGUE_PER_DELIVERY);
        driver.setThoughtMessage(null);
        driver.setStatusDetail(null);

        addSpan(order, "driver-runtime", "delivered", "OK",
                String.format("%.0fs total", durationSec));
        eventService.record("DELIVERED", "order", "info", order.getId(), driver.getId(),
                order.getTraceId(), "Delivered to " + order.getCustomerName(), tickCount);

        if (driver.getFatigue() >= FATIGUE_BREAK_THRESHOLD) {
            driver.setStatus(DriverStatus.ON_BREAK);
            driver.setBreakUntilTick(tickCount + BREAK_TICKS);
            driver.setThoughtMessage("Taking a break");
            eventService.record("DRIVER_BREAK", "driver", "info", null, driver.getId(),
                    null, driver.getName() + " resting (fatigue)", tickCount);
        } else {
            driver.setStatus(DriverStatus.IDLE);
        }
    }

    private void updateMoodsAndDelays() {
        long now = System.currentTimeMillis();
        for (OrderState o : orders.values()) {
            if (o.getStatus() == OrderStatus.DELIVERED) continue;
            long age = now - o.getCreatedAt();
            if (age < 15_000) o.setMood("HAPPY");
            else if (age < 30_000) o.setMood("WAITING");
            else if (age < DELAYED_AGE_MS) o.setMood("FRUSTRATED");
            else o.setMood("ANGRY");

            if (age > DELAYED_AGE_MS && o.getDelayReason() == null) {
                o.setDelayReason("SLA breach: waiting " + (age / 1000) + "s");
                eventService.record("ORDER_DELAYED", "order", "warning", o.getId(), o.getDriverId(),
                        o.getTraceId(), "Order delayed past SLA", tickCount);
            }
        }
    }

    // ------------------------------------------------------------- incidents

    private void maybeSpawnIncident() {
        if (tickCount % INCIDENT_CHECK_TICKS != 0) return;
        if (ThreadLocalRandom.current().nextDouble() > INCIDENT_CHANCE) return;
        if (incidents.size() >= 1) return;
        IncidentType[] types = IncidentType.values();
        spawnIncident(types[ThreadLocalRandom.current().nextInt(types.length)]);
    }

    public Incident spawnIncident(IncidentType type) {
        Incident inc = new Incident();
        inc.setId("inc-" + (++incidentSeq));
        inc.setType(type);
        inc.setStartTick(tickCount);
        inc.setTimestamp(System.currentTimeMillis());
        ThreadLocalRandom rng = ThreadLocalRandom.current();

        switch (type) {
            case TRAFFIC_JAM -> {
                MapEdge e = randomMajorEdge();
                inc.setSeverity("SEV-3");
                inc.setTitle("Traffic congestion");
                inc.setMessage("Heavy traffic on a major arterial");
                inc.setAffectedEdgeId(e.id());
                inc.setZone(cityMap.zoneForNode(e.from()));
                inc.setDurationTicks(30 + rng.nextInt(20));
                cityMap.setEdgeMultiplier(e.id(), 3.0);
                rerouteAffected(e.id());
            }
            case ACCIDENT -> {
                MapEdge e = randomEdge();
                inc.setSeverity("SEV-2");
                inc.setTitle("Road accident");
                inc.setMessage("Accident blocking a road segment");
                inc.setAffectedEdgeId(e.id());
                inc.setZone(cityMap.zoneForNode(e.from()));
                inc.setDurationTicks(40 + rng.nextInt(20));
                cityMap.setEdgeMultiplier(e.id(), 6.0);
                rerouteAffected(e.id());
            }
            case RESTAURANT_DELAY -> {
                List<MapBuilding> rs = cityMap.restaurants();
                MapBuilding r = rs.get(rng.nextInt(rs.size()));
                inc.setSeverity("SEV-3");
                inc.setTitle("Kitchen backlog");
                inc.setMessage(r.name() + " is running slow");
                inc.setAffectedBuildingId(r.id());
                inc.setZone(r.zone());
                inc.setDurationTicks(30 + rng.nextInt(15));
                orders.values().stream()
                        .filter(o -> o.getStatus() != OrderStatus.DELIVERED
                                && r.nodeId().equals(o.getRestaurantNodeId())
                                && o.getCookTimeRemaining() != null)
                        .forEach(o -> o.setCookTimeRemaining(o.getCookTimeRemaining() + 8));
            }
            case DEMAND_SPIKE -> {
                var zones = cityMap.getZones();
                var z = zones.get(rng.nextInt(zones.size()));
                inc.setSeverity("SEV-2");
                inc.setTitle("Demand surge");
                inc.setMessage("Order spike in " + z.name());
                inc.setZone(z.name());
                inc.setDurationTicks(20 + rng.nextInt(10));
                int extra = 3 + rng.nextInt(3);
                for (int i = 0; i < extra; i++) createOrder();
            }
            case DRIVER_OFFLINE -> {
                Optional<DriverState> active = drivers.values().stream()
                        .filter(d -> d.getStatus() == DriverStatus.EN_ROUTE_PICKUP
                                || d.getStatus() == DriverStatus.DELIVERING)
                        .findAny();
                inc.setSeverity("SEV-1");
                inc.setTitle("Driver dropped offline");
                inc.setDurationTicks(20 + rng.nextInt(10));
                if (active.isPresent()) {
                    DriverState d = active.get();
                    inc.setMessage(d.getName() + " went offline mid-delivery");
                    inc.setAffectedDriverId(d.getId());
                    OrderState o = d.getCurrentOrderId() == null ? null : orders.get(d.getCurrentOrderId());
                    d.setStatus(DriverStatus.OFFLINE);
                    d.setCurrentOrderId(null);
                    d.setRoute(new ArrayList<>());
                    if (o != null && o.getStatus() != OrderStatus.DELIVERED) {
                        o.setStatus(OrderStatus.FINDING_DRIVER);
                        o.setDriverId(null);
                        addSpan(o, "dispatch-engine", "dispatch.requeued", "ERROR", "driver offline");
                    }
                } else {
                    inc.setMessage("Driver connectivity issue detected");
                }
            }
            default -> {
                inc.setSeverity("SEV-3");
                inc.setTitle("Weather advisory");
                inc.setMessage("Rain slowing deliveries citywide");
                inc.setDurationTicks(30);
            }
        }

        incidents.put(inc.getId(), inc);
        eventService.record("INCIDENT_OPENED", "incident",
                "SEV-1".equals(inc.getSeverity()) ? "critical" : "warning",
                null, inc.getAffectedDriverId(), null,
                inc.getSeverity() + " " + inc.getTitle() + " - " + inc.getMessage(), tickCount);
        try {
            // broadcast incident change immediately
        } catch (Exception ignored) {
        }
        return inc;
    }

    private void decayIncidents() {
        List<Incident> expired = new ArrayList<>();
        for (Incident inc : incidents.values()) {
            if (inc.isResolved()) continue;
            if (tickCount >= inc.getStartTick() + inc.getDurationTicks()) {
                resolveIncidentInternal(inc, "auto-resolved (duration elapsed)");
                expired.add(inc);
            }
        }
        // keep resolved incidents briefly for UI, then drop
        incidents.values().removeIf(i -> i.isResolved()
                && tickCount > i.getStartTick() + i.getDurationTicks() + 10);
    }

    private void resolveIncidentInternal(Incident inc, String note) {
        if (inc.getAffectedEdgeId() != null) cityMap.clearEdgeMultiplier(inc.getAffectedEdgeId());
        if (inc.getType() == IncidentType.DRIVER_OFFLINE && inc.getAffectedDriverId() != null) {
            DriverState d = drivers.get(inc.getAffectedDriverId());
            if (d != null && d.getStatus() == DriverStatus.OFFLINE) {
                d.setStatus(DriverStatus.IDLE);
            }
        }
        inc.setResolved(true);
        inc.setMitigation(note);
        eventService.record("INCIDENT_RESOLVED", "incident", "info", null, inc.getAffectedDriverId(),
                null, inc.getTitle() + " resolved", tickCount);
    }

    private void rerouteAffected(String edgeId) {
        MapEdge edge = cityMap.edge(edgeId);
        if (edge == null) return;
        for (DriverState d : drivers.values()) {
            if (d.getStatus() != DriverStatus.EN_ROUTE_PICKUP && d.getStatus() != DriverStatus.DELIVERING) continue;
            if (!routeContainsEdge(d.getRoute(), edge)) continue;
            OrderState o = d.getCurrentOrderId() == null ? null : orders.get(d.getCurrentOrderId());
            if (o == null) continue;
            String targetNode = d.getStatus() == DriverStatus.EN_ROUTE_PICKUP
                    ? o.getRestaurantNodeId() : o.getCustomerNodeId();
            Pathfinding.PathResult path = pathfinding.findPath(d.getCurrentNodeId(), targetNode);
            if (path != null && path.nodeIds().size() >= 2) {
                d.setRoute(new ArrayList<>(path.nodeIds()));
                d.setRouteIndex(0);
                d.setProgress(0);
                d.setReroutingUntilTick(tickCount + 8);
                d.setThoughtMessage("Rerouting...");
                eventService.record("REROUTE", "driver", "warning", o.getId(), d.getId(),
                        o.getTraceId(), d.getName() + " rerouted around incident", tickCount);
            }
        }
    }

    private boolean routeContainsEdge(List<String> route, MapEdge edge) {
        if (route == null) return false;
        for (int i = 0; i < route.size() - 1; i++) {
            String a = route.get(i), b = route.get(i + 1);
            if ((a.equals(edge.from()) && b.equals(edge.to()))
                    || (a.equals(edge.to()) && b.equals(edge.from()))) {
                return true;
            }
        }
        return false;
    }

    private MapEdge randomEdge() {
        List<MapEdge> edges = cityMap.getEdges();
        return edges.get(ThreadLocalRandom.current().nextInt(edges.size()));
    }

    private MapEdge randomMajorEdge() {
        List<MapEdge> major = cityMap.getEdges().stream().filter(MapEdge::isMajor).toList();
        if (major.isEmpty()) return randomEdge();
        return major.get(ThreadLocalRandom.current().nextInt(major.size()));
    }

    // -------------------------------------------------------------- traces

    private void startTrace(OrderState o) {
        OrderTrace t = new OrderTrace();
        t.setTraceId(o.getTraceId());
        t.setOrderId(o.getId());
        t.setStartTime(System.currentTimeMillis());
        t.setLastUpdate(t.getStartTime());
        t.setCurrentStatus(o.getStatus().name());
        traces.put(o.getId(), t);
    }

    private void addSpan(OrderState o, String service, String operation, String status, String detail) {
        OrderTrace t = traces.get(o.getId());
        if (t == null) return;
        long now = System.currentTimeMillis();
        TraceSpan span = new TraceSpan();
        span.setSpanId("span-" + UUID.randomUUID().toString().substring(0, 6));
        span.setService(service);
        span.setOperation(operation);
        span.setStartOffsetMs(now - t.getStartTime());
        span.setDurationMs(Math.max(1, now - t.getLastUpdate()));
        span.setStatus(status);
        span.setDetail(detail);
        t.getSpans().add(span);
        t.setLastUpdate(now);
        t.setCurrentStatus(o.getStatus().name());
    }

    private void trimMaps() {
        // drop oldest delivered orders + their traces beyond cap
        if (orders.size() > 400) {
            List<String> delivered = orders.values().stream()
                    .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                    .sorted(Comparator.comparingLong(o -> o.getDeliveredAt() == null ? 0 : o.getDeliveredAt()))
                    .map(OrderState::getId)
                    .toList();
            int toRemove = orders.size() - 400;
            for (int i = 0; i < toRemove && i < delivered.size(); i++) {
                orders.remove(delivered.get(i));
            }
        }
        while (traces.size() > TRACE_CAP) {
            Iterator<String> it = traces.keySet().iterator();
            if (it.hasNext()) {
                it.next();
                it.remove();
            } else break;
        }
    }

    private void pushDispatch(DispatchAttempt attempt) {
        recentDispatch.addFirst(attempt);
        while (recentDispatch.size() > RECENT_DISPATCH_CAP) recentDispatch.removeLast();
    }

    // ----------------------------------------------------------- lifecycle ctl

    public void reset() {
        synchronized (lock) {
            orders.clear();
            traces.clear();
            recentDispatch.clear();
            deliveryDurations.clear();
            incidents.clear();
            holdQueue.clear();
            holdStartTick.clear();
            tickCount = 0;
            lastOrderTick = 0;
            totalOrdersGenerated = 0;
            totalDeliveries = 0;
            orderSeq = 0;
            incidentSeq = 0;
            ordersInWindow = 0;
            totalFleetMiles = 0;
            batchedOrders = 0;
            totalHoldTimeMs = 0;
            holdTimeSamples = 0;
            startTimeMs = System.currentTimeMillis();
            for (DriverState d : drivers.values()) {
                d.setStatus(DriverStatus.IDLE);
                d.setCurrentOrderId(null);
                d.setRoute(new ArrayList<>());
                d.setRouteIndex(0);
                d.setProgress(0);
                d.setFatigue(0);
                d.setThoughtMessage(null);
                d.setStatusDetail(null);
                d.setReroutingUntilTick(null);
                d.setBreakUntilTick(null);
                d.setOrderBatch(new ArrayList<>());
                d.setBatchStopNodes(new ArrayList<>());
                d.setBatchId(null);
                d.setBatchSize(0);
                d.setBatchStopIndex(0);
            }
        }
    }

    public void setStrategy(DispatchStrategy s) {
        this.strategy = s;
    }

    public DispatchStrategy getStrategy() {
        return strategy;
    }

    // ----------------------------------------------------------- admin actions

    public DriverState deployDriver(VehicleType type) {
        synchronized (lock) {
            List<String> nodeIds = cityMap.getNodes().stream().map(n -> n.id()).toList();
            DriverState d = newDriver(type, nodeIds, null);
            drivers.put(d.getId(), d);
            eventService.record("DRIVER_DEPLOYED", "driver", "info", null, d.getId(), null,
                    "Deployed " + type + " driver " + d.getName(), tickCount);
            return d;
        }
    }

    public boolean reassignOrder(String orderId) {
        synchronized (lock) {
            OrderState o = orders.get(orderId);
            if (o == null || o.getStatus() == OrderStatus.DELIVERED) return false;
            if (o.getDriverId() != null) {
                DriverState old = drivers.get(o.getDriverId());
                if (old != null) {
                    old.setStatus(DriverStatus.IDLE);
                    old.setCurrentOrderId(null);
                    old.setRoute(new ArrayList<>());
                }
            }
            o.setStatus(OrderStatus.FINDING_DRIVER);
            o.setDriverId(null);
            addSpan(o, "dispatch-engine", "dispatch.manual-reassign", "OK", "operator action");
            eventService.record("ORDER_REASSIGNED", "order", "warning", o.getId(), null,
                    o.getTraceId(), "Operator requested re-dispatch", tickCount);
            return true;
        }
    }

    public boolean cancelOrder(String orderId) {
        synchronized (lock) {
            OrderState o = orders.get(orderId);
            if (o == null || o.getStatus() == OrderStatus.DELIVERED) return false;
            if (o.getDriverId() != null) {
                DriverState d = drivers.get(o.getDriverId());
                if (d != null) {
                    d.setStatus(DriverStatus.IDLE);
                    d.setCurrentOrderId(null);
                    d.setRoute(new ArrayList<>());
                }
            }
            orders.remove(orderId);
            eventService.record("ORDER_CANCELLED", "order", "warning", orderId, null,
                    o.getTraceId(), "Order cancelled by operator", tickCount);
            return true;
        }
    }

    public boolean boostPriority(String orderId) {
        synchronized (lock) {
            OrderState o = orders.get(orderId);
            if (o == null) return false;
            o.setPriority(Math.min(5, o.getPriority() + 1));
            eventService.record("ORDER_PRIORITY", "order", "info", orderId, null,
                    o.getTraceId(), "Priority boosted to " + o.getPriority(), tickCount);
            return true;
        }
    }

    public boolean forceOffline(String driverId) {
        synchronized (lock) {
            DriverState d = drivers.get(driverId);
            if (d == null) return false;
            if (d.getCurrentOrderId() != null) {
                OrderState o = orders.get(d.getCurrentOrderId());
                if (o != null && o.getStatus() != OrderStatus.DELIVERED) {
                    o.setStatus(OrderStatus.FINDING_DRIVER);
                    o.setDriverId(null);
                }
            }
            d.setStatus(DriverStatus.OFFLINE);
            d.setCurrentOrderId(null);
            d.setRoute(new ArrayList<>());
            eventService.record("DRIVER_OFFLINE", "driver", "warning", null, driverId, null,
                    d.getName() + " forced offline", tickCount);
            return true;
        }
    }

    public boolean bringOnline(String driverId) {
        synchronized (lock) {
            DriverState d = drivers.get(driverId);
            if (d == null) return false;
            if (d.getStatus() == DriverStatus.OFFLINE || d.getStatus() == DriverStatus.ON_BREAK) {
                d.setStatus(DriverStatus.IDLE);
                d.setFatigue(0);
                d.setBreakUntilTick(null);
            }
            return true;
        }
    }

    public boolean relocateDriver(String driverId, String zoneName) {
        synchronized (lock) {
            DriverState d = drivers.get(driverId);
            if (d == null || d.getStatus() != DriverStatus.IDLE) return false;
            List<String> zoneNodes = cityMap.getNodes().stream()
                    .filter(n -> n.zone().equalsIgnoreCase(zoneName))
                    .map(n -> n.id()).toList();
            if (zoneNodes.isEmpty()) return false;
            d.setCurrentNodeId(zoneNodes.get(ThreadLocalRandom.current().nextInt(zoneNodes.size())));
            d.setRoute(new ArrayList<>());
            eventService.record("DRIVER_RELOCATED", "driver", "info", null, driverId, null,
                    d.getName() + " relocated to " + zoneName, tickCount);
            return true;
        }
    }

    public int rushDelayed() {
        synchronized (lock) {
            int boosted = 0;
            for (OrderState o : orders.values()) {
                if (o.getStatus() != OrderStatus.DELIVERED && o.getDelayReason() != null) {
                    o.setPriority(5);
                    boosted++;
                }
            }
            eventService.record("RUSH_DELAYED", "system", "info", null, null, null,
                    "Operator rushed " + boosted + " delayed orders", tickCount);
            return boosted;
        }
    }

    public int recalculateRoutes() {
        synchronized (lock) {
            int recomputed = 0;
            for (DriverState d : drivers.values()) {
                if (d.getStatus() != DriverStatus.EN_ROUTE_PICKUP && d.getStatus() != DriverStatus.DELIVERING) continue;
                OrderState o = d.getCurrentOrderId() == null ? null : orders.get(d.getCurrentOrderId());
                if (o == null) continue;
                String target = d.getStatus() == DriverStatus.EN_ROUTE_PICKUP
                        ? o.getRestaurantNodeId() : o.getCustomerNodeId();
                Pathfinding.PathResult path = pathfinding.findPath(d.getCurrentNodeId(), target);
                if (path != null && path.nodeIds().size() >= 2) {
                    d.setRoute(new ArrayList<>(path.nodeIds()));
                    d.setRouteIndex(0);
                    d.setProgress(0);
                    d.setReroutingUntilTick(tickCount + 6);
                    recomputed++;
                }
            }
            eventService.record("ROUTES_RECALCULATED", "system", "info", null, null, null,
                    "Recalculated " + recomputed + " active routes", tickCount);
            return recomputed;
        }
    }

    public boolean mitigateIncident(String incidentId) {
        synchronized (lock) {
            Incident inc = incidents.get(incidentId);
            if (inc == null || inc.isResolved()) return false;
            if (inc.getAffectedEdgeId() != null) {
                cityMap.setEdgeMultiplier(inc.getAffectedEdgeId(), 1.5); // partial relief
            }
            inc.setMitigated(true);
            inc.setMitigation("Operator mitigation applied");
            inc.setDurationTicks(Math.min(inc.getDurationTicks(), tickCount - inc.getStartTick() + 6));
            eventService.record("INCIDENT_MITIGATED", "incident", "info", null, inc.getAffectedDriverId(),
                    null, inc.getTitle() + " mitigated by operator", tickCount);
            return true;
        }
    }

    public boolean resolveIncident(String incidentId) {
        synchronized (lock) {
            Incident inc = incidents.get(incidentId);
            if (inc == null || inc.isResolved()) return false;
            resolveIncidentInternal(inc, "Operator resolved");
            return true;
        }
    }

    // -------------------------------------------------------------- read APIs

    public List<DriverState> driverList() {
        synchronized (lock) {
            return new ArrayList<>(drivers.values());
        }
    }

    public DriverState driver(String id) {
        return drivers.get(id);
    }

    public List<OrderState> orderList() {
        synchronized (lock) {
            return new ArrayList<>(orders.values());
        }
    }

    public OrderState order(String id) {
        return orders.get(id);
    }

    public List<Incident> incidentList() {
        return new ArrayList<>(incidents.values());
    }

    public List<DispatchAttempt> recentDispatch() {
        synchronized (lock) {
            return new ArrayList<>(recentDispatch);
        }
    }

    public DispatchAttempt dispatchForOrder(String orderId) {
        synchronized (lock) {
            return recentDispatch.stream()
                    .filter(a -> a.getOrderId().equals(orderId))
                    .findFirst().orElse(null);
        }
    }

    public OrderTrace trace(String orderId) {
        return traces.get(orderId);
    }

    public List<Double> deliveryDurations() {
        synchronized (lock) {
            return new ArrayList<>(deliveryDurations);
        }
    }

    public long getTickCount() {
        return tickCount;
    }

    public int getTotalOrdersGenerated() {
        return totalOrdersGenerated;
    }

    public int getTotalDeliveries() {
        return totalDeliveries;
    }

    public long getStartTimeMs() {
        return startTimeMs;
    }

    /** Orders generated in the rolling window since last sampled; used for orders/min. */
    public long sampleOrdersWindow() {
        long v = ordersInWindow;
        ordersInWindow = 0;
        return v;
    }

    public double getTotalFleetMiles() { return totalFleetMiles; }
    public int getBatchedOrders() { return batchedOrders; }
    public double getAvgHoldTimeMs() {
        return holdTimeSamples > 0 ? totalHoldTimeMs / holdTimeSamples : 0;
    }
    public double getAvgBatchSize() {
        return batchedOrders > 0 && totalDeliveries > 0
                ? (double) batchedOrders / Math.max(1, recentDispatch.stream()
                        .filter(a -> a.getBatchId() != null).count())
                : 1.0;
    }
}
