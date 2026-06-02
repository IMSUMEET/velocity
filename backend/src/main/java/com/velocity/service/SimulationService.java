package com.velocity.service;

import com.velocity.engine.SimulationEngine;
import com.velocity.kafka.KafkaProducerService;
import com.velocity.map.CityMap;
import com.velocity.model.*;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.model.enums.DriverStatus;
import com.velocity.model.enums.OrderStatus;
import com.velocity.model.enums.VehicleType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/**
 * Scheduled tick loop that drives the simulation engine and broadcasts
 * full-state snapshots over STOMP WebSocket every tick. Also computes
 * aggregate metrics and zone heat for the control-plane dashboard.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SimulationService {

    private final SimulationEngine engine;
    private final EventService eventService;
    private final QueueMetricsService queueMetricsService;
    private final SimpMessagingTemplate messagingTemplate;
    private final KafkaProducerService kafkaProducerService;
    private final CityMap cityMap;

    @Autowired(required = false)
    private StringRedisTemplate redis;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean paused = new AtomicBoolean(false);
    private volatile double speedMultiplier = 1.0;

    private long lastMetricsSampleMs = System.currentTimeMillis();
    private double smoothedOpm = 0;
    private long lastCompletedSnapshot = 0;

    // ----------------------------------------------------------- lifecycle

    public void start() {
        running.set(true);
        paused.set(false);
        log.info("Simulation started");
        broadcastState();
    }

    public void pause() {
        paused.set(true);
        log.info("Simulation paused");
        broadcastState();
    }

    public void resume() {
        paused.set(false);
        log.info("Simulation resumed");
        broadcastState();
    }

    public void reset() {
        running.set(false);
        paused.set(false);
        speedMultiplier = 1.0;
        engine.reset();
        log.info("Simulation reset");
        broadcastState();
    }

    public void setSpeedMultiplier(double m) {
        this.speedMultiplier = Math.max(0.25, Math.min(10, m));
        log.info("Speed multiplier set to {}", speedMultiplier);
        broadcastState();
    }

    // ----------------------------------------------------------- tick loop

    @Scheduled(fixedRateString = "${velocity.simulation.tick-interval-ms:500}")
    public void tick() {
        if (!running.get() || paused.get()) return;
        try {
            engine.tick(speedMultiplier);
            broadcastSnapshot();
        } catch (Exception e) {
            log.error("Tick error", e);
        }
    }

    // ----------------------------------------------------------- snapshot

    public Snapshot buildSnapshot() {
        Snapshot s = new Snapshot();
        s.setSimulation(buildSimState());
        s.setDrivers(engine.driverList());
        s.setOrders(engine.orderList());
        s.setIncidents(engine.incidentList());
        s.setZones(computeZones());
        s.setQueues(queueMetricsService.snapshot());
        s.setRecentDispatch(engine.recentDispatch());
        s.setRecentEvents(eventService.recent(50));
        s.setMetrics(computeMetrics());
        return s;
    }

    private void broadcastSnapshot() {
        Snapshot snap = buildSnapshot();
        Metrics metrics = snap.getMetrics();

        // update queue metrics based on current state
        int pending = (int) snap.getOrders().stream()
                .filter(o -> o.getStatus() == OrderStatus.CREATED || o.getStatus() == OrderStatus.FINDING_DRIVER)
                .count();
        int inProgress = (int) snap.getOrders().stream()
                .filter(o -> o.getStatus() != OrderStatus.DELIVERED && o.getStatus() != OrderStatus.CREATED
                        && o.getStatus() != OrderStatus.FINDING_DRIVER)
                .count();
        queueMetricsService.update(pending, inProgress, eventService.producedCount());

        try {
            messagingTemplate.convertAndSend("/topic/snapshot", snap);
        } catch (Exception e) {
            log.debug("WS broadcast failed: {}", e.getMessage());
        }

        cacheMetricsToRedis(metrics);

        kafkaProducerService.sendEvent("simulation-tick",
                String.valueOf(engine.getTickCount()), snap.getSimulation());
    }

    private void broadcastState() {
        try {
            messagingTemplate.convertAndSend("/topic/simulation", buildSimState());
        } catch (Exception ignored) {
        }
    }

    // ----------------------------------------------------------- metrics

    public Metrics computeMetrics() {
        List<DriverState> drivers = engine.driverList();
        List<OrderState> orders = engine.orderList();

        int totalDrivers = drivers.size();
        int activeDrivers = (int) drivers.stream()
                .filter(d -> d.getStatus() != DriverStatus.IDLE
                        && d.getStatus() != DriverStatus.OFFLINE
                        && d.getStatus() != DriverStatus.ON_BREAK).count();
        int idleDrivers = (int) drivers.stream().filter(d -> d.getStatus() == DriverStatus.IDLE).count();

        int pendingOrders = (int) orders.stream()
                .filter(o -> o.getStatus() == OrderStatus.CREATED || o.getStatus() == OrderStatus.FINDING_DRIVER).count();
        int inProgress = (int) orders.stream()
                .filter(o -> o.getStatus() != OrderStatus.DELIVERED && o.getStatus() != OrderStatus.CREATED
                        && o.getStatus() != OrderStatus.FINDING_DRIVER).count();
        int completed = engine.getTotalDeliveries();
        int delayed = (int) orders.stream().filter(o -> o.getDelayReason() != null).count();

        double utilization = totalDrivers > 0 ? (double) activeDrivers / totalDrivers : 0;

        // percentile delivery durations
        List<Double> durations = engine.deliveryDurations();
        PercentileMetrics perc = computePercentiles(durations);

        // orders per minute — use completed deliveries rate with EMA smoothing
        long now = System.currentTimeMillis();
        long windowMs = now - lastMetricsSampleMs;
        int currentCompleted = engine.getTotalDeliveries();
        if (windowMs > 2000) {
            long deltaCompleted = currentCompleted - lastCompletedSnapshot;
            double rawOpm = windowMs > 0 ? (deltaCompleted * 60000.0 / windowMs) : 0;
            smoothedOpm = smoothedOpm == 0 ? rawOpm : smoothedOpm * 0.8 + rawOpm * 0.2;
            lastMetricsSampleMs = now;
            lastCompletedSnapshot = currentCompleted;
        }
        double opm = Math.round(smoothedOpm * 10) / 10.0;

        double revenue = orders.stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .mapToDouble(OrderState::getEstimatedValue).sum();

        String health = pendingOrders > 10 ? "critical" : pendingOrders > 5 ? "busy" : "stable";
        int incidents = engine.incidentList().size();

        double satisfaction = 100 - delayed * 5.0 - pendingOrders * 2.0;

        int velocityScore = (int) Math.max(0, Math.min(100,
                80 + completed * 0.2 - delayed * 3 - pendingOrders * 1.5));

        Metrics m = new Metrics();
        m.setTotalDrivers(totalDrivers);
        m.setActiveDrivers(activeDrivers);
        m.setIdleDrivers(idleDrivers);
        m.setPendingOrders(pendingOrders);
        m.setInProgressOrders(inProgress);
        m.setCompletedDeliveries(completed);
        m.setDelayedOrders(delayed);
        m.setDriverUtilization(Math.round(utilization * 1000) / 1000.0);
        m.setDispatchSuccessRate(completed > 0 ? 1.0 : 0.0);
        m.setDeliveryPercentiles(perc);
        m.setOrdersPerMinute(Math.round(opm * 10) / 10.0);
        m.setRevenue(Math.round(revenue * 100) / 100.0);
        m.setNetworkHealth(health);
        m.setActiveIncidents(incidents);
        m.setCustomerSatisfaction(Math.max(0, Math.round(satisfaction * 10) / 10.0));
        m.setVelocityScore(velocityScore);
        m.setAverageEta(perc.getP50());

        double fleetMiles = Math.round(engine.getTotalFleetMiles() * 10) / 10.0;
        m.setTotalFleetMiles(fleetMiles);
        m.setMilesPerDelivery(completed > 0 ? Math.round(fleetMiles / completed * 100) / 100.0 : 0);
        m.setAvgBatchSize(Math.round(engine.getAvgBatchSize() * 10) / 10.0);
        m.setBatchedOrders(engine.getBatchedOrders());
        m.setHoldTimeAvgMs(Math.round(engine.getAvgHoldTimeMs() * 10) / 10.0);

        return m;
    }

    private PercentileMetrics computePercentiles(List<Double> durations) {
        PercentileMetrics p = new PercentileMetrics();
        if (durations.isEmpty()) return p;
        List<Double> sorted = new ArrayList<>(durations);
        sorted.sort(Double::compareTo);
        p.setCount(sorted.size());
        p.setP50(percentile(sorted, 50));
        p.setP95(percentile(sorted, 95));
        p.setP99(percentile(sorted, 99));
        return p;
    }

    private double percentile(List<Double> sorted, int pct) {
        int idx = Math.max(0, (int) Math.ceil(pct / 100.0 * sorted.size()) - 1);
        return Math.round(sorted.get(idx) * 10) / 10.0;
    }

    // ----------------------------------------------------------- zones

    private List<ZoneHeat> computeZones() {
        Map<String, Integer> counts = new HashMap<>();
        for (OrderState o : engine.orderList()) {
            if (o.getStatus() != OrderStatus.DELIVERED) {
                String zone = cityMap.zoneForNode(o.getRestaurantNodeId());
                counts.merge(zone, 1, Integer::sum);
            }
        }
        return cityMap.getZones().stream().map(z -> {
            ZoneHeat zh = new ZoneHeat();
            zh.setZoneName(z.name());
            int c = counts.getOrDefault(z.name(), 0);
            zh.setOrderCount(c);
            zh.setIntensity(c >= 5 ? "SURGE" : c >= 3 ? "HIGH" : c >= 1 ? "MEDIUM" : "LOW");
            return zh;
        }).toList();
    }

    // ----------------------------------------------------------- state

    public SimulationState buildSimState() {
        SimulationState s = new SimulationState();
        s.setRunning(running.get());
        s.setPaused(paused.get());
        s.setSpeedMultiplier(speedMultiplier);
        s.setTickCount(engine.getTickCount());
        s.setElapsedMs(running.get() ? System.currentTimeMillis() - engine.getStartTimeMs() : 0);
        s.setTotalOrdersGenerated(engine.getTotalOrdersGenerated());
        s.setTotalDeliveries(engine.getTotalDeliveries());
        s.setDispatchStrategy(engine.getStrategy());
        return s;
    }

    // ----------------------------------------------------------- pass-through admin

    public DriverState deployDriver(VehicleType type) {
        return engine.deployDriver(type);
    }

    public boolean reassignOrder(String orderId) {
        return engine.reassignOrder(orderId);
    }

    public boolean cancelOrder(String orderId) {
        return engine.cancelOrder(orderId);
    }

    public boolean boostPriority(String orderId) {
        return engine.boostPriority(orderId);
    }

    public boolean forceOffline(String driverId) {
        return engine.forceOffline(driverId);
    }

    public boolean bringOnline(String driverId) {
        return engine.bringOnline(driverId);
    }

    public boolean relocateDriver(String driverId, String zone) {
        return engine.relocateDriver(driverId, zone);
    }

    public int rushDelayed() {
        return engine.rushDelayed();
    }

    public int recalculateRoutes() {
        return engine.recalculateRoutes();
    }

    public boolean mitigateIncident(String id) {
        return engine.mitigateIncident(id);
    }

    public boolean resolveIncident(String id) {
        return engine.resolveIncident(id);
    }

    public void setStrategy(DispatchStrategy s) {
        engine.setStrategy(s);
    }

    // ----------------------------------------------------------- redis

    private void cacheMetricsToRedis(Metrics m) {
        if (redis == null) return;
        try {
            redis.opsForValue().set("velocity:metrics:active_drivers", String.valueOf(m.getActiveDrivers()));
            redis.opsForValue().set("velocity:metrics:pending_orders", String.valueOf(m.getPendingOrders()));
            redis.opsForValue().set("velocity:metrics:completed", String.valueOf(m.getCompletedDeliveries()));
            redis.opsForValue().set("velocity:metrics:health", m.getNetworkHealth());
        } catch (Exception e) {
            log.debug("Redis metrics cache failed: {}", e.getMessage());
        }
    }
}
