package com.velocity.engine;

import com.velocity.map.CityMap;
import com.velocity.map.Pathfinding;
import com.velocity.model.*;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.model.enums.VehicleType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Multi-factor dispatch engine. Lower score wins. Supports greedy strategies
 * and two batch strategies (BATCH_NEARBY, BATCH_OPTIMAL) that group proximal
 * orders into multi-stop routes.
 */
@Component
@RequiredArgsConstructor
public class DispatchEngine {

    private static final double BATCH_PROXIMITY_THRESHOLD = 200.0;
    private static final int MAX_BATCH_SIZE = 3;

    private final Pathfinding pathfinding;
    private final CityMap cityMap;

    // ---------------------------------------------------------------- greedy

    public DispatchAttempt evaluate(OrderState order, List<DriverState> idleDrivers,
                                    DispatchStrategy strategy, long nowMs) {
        DispatchAttempt attempt = new DispatchAttempt();
        attempt.setId("dsp-" + UUID.randomUUID().toString().substring(0, 8));
        attempt.setOrderId(order.getId());
        attempt.setRestaurantName(order.getRestaurantName());
        attempt.setStrategy(strategy);
        attempt.setTimestamp(nowMs);

        List<DispatchCandidate> candidates = new ArrayList<>();
        for (DriverState driver : idleDrivers) {
            Pathfinding.PathResult path = pathfinding.findPath(driver.getCurrentNodeId(), order.getRestaurantNodeId());
            if (path == null) continue;
            candidates.add(scoreCandidate(driver, order, path, strategy, nowMs));
        }
        attempt.setCandidatesEvaluated(candidates.size());

        candidates.sort(Comparator.comparingDouble(DispatchCandidate::getScore));
        attempt.setCandidates(candidates);

        if (!candidates.isEmpty()) {
            DispatchCandidate best = candidates.get(0);
            best.setSelected(true);
            for (int i = 1; i < candidates.size(); i++) {
                candidates.get(i).setRejectReason("higher score than " + best.getDriverName());
            }
            attempt.setMatched(true);
            attempt.setSelectedDriverId(best.getDriverId());
            attempt.setSelectedDriverName(best.getDriverName());
            attempt.setScore(best.getScore());
            attempt.setDistance(best.getDistance());
            attempt.setEta(best.getEta());
            attempt.setReason(buildReason(best, order, strategy));
        }
        return attempt;
    }

    // ---------------------------------------------------------------- batch

    /**
     * Groups held orders into spatially-proximal batches and assigns each batch
     * to the best idle driver. Returns one DispatchAttempt per batch assigned.
     * Unassigned (un-batchable or no driver) orders are left in heldOrders for
     * the next invocation.
     */
    public List<BatchPlan> evaluateBatch(List<OrderState> heldOrders,
                                         List<DriverState> idleDrivers,
                                         DispatchStrategy strategy,
                                         long nowMs) {
        if (idleDrivers.isEmpty() || heldOrders.isEmpty()) return Collections.emptyList();

        // Cluster orders by proximity of restaurant nodes
        List<List<OrderState>> clusters = clusterOrders(heldOrders, strategy);

        List<BatchPlan> plans = new ArrayList<>();
        Set<String> assignedDriverIds = new HashSet<>();
        Set<String> assignedOrderIds = new HashSet<>();

        for (List<OrderState> cluster : clusters) {
            if (cluster.isEmpty()) continue;

            // Pick best idle driver for this cluster (nearest to cluster centroid)
            DriverState bestDriver = selectDriverForCluster(cluster, idleDrivers, assignedDriverIds);
            if (bestDriver == null) continue;

            BatchPlan plan = buildBatchPlan(bestDriver, cluster, strategy, nowMs);
            if (plan == null) continue;

            plans.add(plan);
            assignedDriverIds.add(bestDriver.getId());
            cluster.forEach(o -> assignedOrderIds.add(o.getId()));
        }

        // Remove assigned orders from heldOrders list
        heldOrders.removeIf(o -> assignedOrderIds.contains(o.getId()));

        return plans;
    }

    private List<List<OrderState>> clusterOrders(List<OrderState> orders, DispatchStrategy strategy) {
        List<List<OrderState>> clusters = new ArrayList<>();
        boolean[] used = new boolean[orders.size()];

        for (int i = 0; i < orders.size(); i++) {
            if (used[i]) continue;
            List<OrderState> cluster = new ArrayList<>();
            cluster.add(orders.get(i));
            used[i] = true;

            if (strategy == DispatchStrategy.BATCH_NEARBY || strategy == DispatchStrategy.BATCH_OPTIMAL) {
                for (int j = i + 1; j < orders.size() && cluster.size() < MAX_BATCH_SIZE; j++) {
                    if (used[j]) continue;
                    double dist = cityMap.distanceBetween(
                            orders.get(i).getRestaurantNodeId(),
                            orders.get(j).getRestaurantNodeId());
                    if (dist <= BATCH_PROXIMITY_THRESHOLD) {
                        cluster.add(orders.get(j));
                        used[j] = true;
                    }
                }
            }
            clusters.add(cluster);
        }
        return clusters;
    }

    private DriverState selectDriverForCluster(List<OrderState> cluster,
                                                List<DriverState> idleDrivers,
                                                Set<String> usedDriverIds) {
        // Centroid of restaurant nodes in this cluster
        double cx = cluster.stream()
                .mapToDouble(o -> {
                    var node = cityMap.node(o.getRestaurantNodeId());
                    return node != null ? node.x() : 0;
                }).average().orElse(0);
        double cy = cluster.stream()
                .mapToDouble(o -> {
                    var node = cityMap.node(o.getRestaurantNodeId());
                    return node != null ? node.y() : 0;
                }).average().orElse(0);

        DriverState best = null;
        double bestDist = Double.MAX_VALUE;
        for (DriverState d : idleDrivers) {
            if (usedDriverIds.contains(d.getId())) continue;
            var node = cityMap.node(d.getCurrentNodeId());
            if (node == null) continue;
            double dist = Math.hypot(node.x() - cx, node.y() - cy);
            if (dist < bestDist) {
                bestDist = dist;
                best = d;
            }
        }
        return best;
    }

    /**
     * Builds the multi-stop route for a batch using nearest-neighbour (BATCH_NEARBY)
     * or greedy TSP insertion (BATCH_OPTIMAL). Route: driver → pickups (sorted) → drops (same order).
     */
    BatchPlan buildBatchPlan(DriverState driver, List<OrderState> orders,
                             DispatchStrategy strategy, long nowMs) {
        List<OrderState> orderedPickups = strategy == DispatchStrategy.BATCH_OPTIMAL
                ? tspInsertionOrder(driver.getCurrentNodeId(), orders)
                : nearestNeighbourOrder(driver.getCurrentNodeId(), orders);

        // Build route: driver → each restaurant in order → each customer in same order
        List<String> routeNodes = new ArrayList<>();
        double totalDist = 0;

        String cursor = driver.getCurrentNodeId();
        List<String> pickupNodes = new ArrayList<>();
        List<String> dropNodes = new ArrayList<>();

        for (OrderState o : orderedPickups) {
            Pathfinding.PathResult p = pathfinding.findPath(cursor, o.getRestaurantNodeId());
            if (p == null) return null;
            List<String> segment = p.nodeIds();
            if (!routeNodes.isEmpty()) segment = segment.subList(1, segment.size());
            routeNodes.addAll(segment);
            totalDist += p.totalCost();
            cursor = o.getRestaurantNodeId();
            pickupNodes.add(o.getRestaurantNodeId());
            dropNodes.add(o.getCustomerNodeId());
        }
        for (String drop : dropNodes) {
            Pathfinding.PathResult p = pathfinding.findPath(cursor, drop);
            if (p == null) return null;
            List<String> segment = p.nodeIds();
            if (!routeNodes.isEmpty()) segment = segment.subList(1, segment.size());
            routeNodes.addAll(segment);
            totalDist += p.totalCost();
            cursor = drop;
        }

        // Greedy baseline: sum of individual round-trips for savings estimate
        double greedyBaseline = 0;
        for (OrderState o : orderedPickups) {
            Pathfinding.PathResult p1 = pathfinding.findPath(driver.getCurrentNodeId(), o.getRestaurantNodeId());
            Pathfinding.PathResult p2 = p1 != null ? pathfinding.findPath(o.getRestaurantNodeId(), o.getCustomerNodeId()) : null;
            if (p1 != null && p2 != null) greedyBaseline += p1.totalCost() + p2.totalCost();
        }
        double savings = greedyBaseline > 0 ? (1 - totalDist / greedyBaseline) * 100 : 0;

        long avgHoldMs = (long) orderedPickups.stream()
                .mapToLong(o -> o.getHoldStartMs() > 0 ? nowMs - o.getHoldStartMs() : 0)
                .average().orElse(0);

        BatchPlan plan = new BatchPlan();
        plan.setId("batch-" + UUID.randomUUID().toString().substring(0, 8));
        plan.setDriverId(driver.getId());
        plan.setOrderIds(orderedPickups.stream().map(OrderState::getId).toList());
        plan.setRouteNodes(routeNodes);
        plan.setTotalDistance(round(totalDist));
        plan.setEstimatedTime(round(totalDist * (driver.getVehicleType() == VehicleType.BIKE ? 0.85 : 1.0)));
        plan.setHoldTicks((int)(avgHoldMs / 500));
        plan.setGreedyBaselineDistance(round(greedyBaseline));
        plan.setSavingsPercent(round(Math.max(0, savings)));
        plan.setCreatedAt(nowMs);
        return plan;
    }

    private List<OrderState> nearestNeighbourOrder(String startNode, List<OrderState> orders) {
        List<OrderState> remaining = new ArrayList<>(orders);
        List<OrderState> sorted = new ArrayList<>();
        String cursor = startNode;
        while (!remaining.isEmpty()) {
            OrderState nearest = remaining.stream()
                    .min(Comparator.comparingDouble(o -> cityMap.distanceBetween(cursor, o.getRestaurantNodeId())))
                    .orElseThrow();
            sorted.add(nearest);
            remaining.remove(nearest);
        }
        return sorted;
    }

    private List<OrderState> tspInsertionOrder(String startNode, List<OrderState> orders) {
        if (orders.size() <= 2) return nearestNeighbourOrder(startNode, orders);
        // Greedy cheapest insertion TSP heuristic
        List<OrderState> tour = new ArrayList<>();
        List<OrderState> remaining = new ArrayList<>(orders);
        // Start with nearest to driver
        OrderState first = remaining.stream()
                .min(Comparator.comparingDouble(o -> cityMap.distanceBetween(startNode, o.getRestaurantNodeId())))
                .orElseThrow();
        tour.add(first);
        remaining.remove(first);

        while (!remaining.isEmpty()) {
            double bestIncrease = Double.MAX_VALUE;
            int bestPos = 0;
            OrderState bestOrder = null;

            for (OrderState candidate : remaining) {
                for (int i = 0; i <= tour.size(); i++) {
                    String prev = i == 0 ? startNode : tour.get(i - 1).getRestaurantNodeId();
                    String next = i == tour.size() ? null : tour.get(i).getRestaurantNodeId();
                    double cost = cityMap.distanceBetween(prev, candidate.getRestaurantNodeId())
                            + (next != null ? cityMap.distanceBetween(candidate.getRestaurantNodeId(), next) : 0)
                            - (next != null ? cityMap.distanceBetween(prev, next) : 0);
                    if (cost < bestIncrease) {
                        bestIncrease = cost;
                        bestPos = i;
                        bestOrder = candidate;
                    }
                }
            }
            if (bestOrder != null) {
                tour.add(bestPos, bestOrder);
                remaining.remove(bestOrder);
            }
        }
        return tour;
    }

    // ---------------------------------------------------------------- scoring

    private DispatchCandidate scoreCandidate(DriverState driver, OrderState order,
                                             Pathfinding.PathResult path, DispatchStrategy strategy, long nowMs) {
        double distance = path.totalCost();
        double vehicleFactor = driver.getVehicleType() == VehicleType.BIKE ? 0.85 : 1.0;
        double eta = distance * vehicleFactor;
        double ageMinutes = (nowMs - order.getCreatedAt()) / 60000.0;

        double distanceScore = distance * 0.35;
        double etaScore = eta * 0.25;
        double orderAgeScore = ageMinutes * 0.20;
        double experienceBonus = -(driver.getExperience() * 0.5);
        double vehicleBonus = driver.getVehicleType() == VehicleType.BIKE ? -2.0 : 0.0;
        double batchBonus = 0.0;

        double total;
        switch (strategy) {
            case FASTEST_ETA -> total = eta * 0.8 + distanceScore * 0.2 - orderAgeScore;
            case LOWEST_COST -> total = distance * 0.7 + etaScore * 0.3 - orderAgeScore;
            default -> total = distanceScore + etaScore - orderAgeScore + experienceBonus + vehicleBonus + batchBonus;
        }

        ScoreBreakdown breakdown = new ScoreBreakdown();
        breakdown.setDistanceScore(round(distanceScore));
        breakdown.setEtaScore(round(etaScore));
        breakdown.setOrderAgeScore(round(orderAgeScore));
        breakdown.setExperienceBonus(round(experienceBonus));
        breakdown.setVehicleBonus(round(vehicleBonus));
        breakdown.setBatchBonus(round(batchBonus));
        breakdown.setTotal(round(total));

        DispatchCandidate c = new DispatchCandidate();
        c.setDriverId(driver.getId());
        c.setDriverName(driver.getName());
        c.setVehicleType(driver.getVehicleType().name());
        c.setScore(round(total));
        c.setDistance(round(distance));
        c.setEta(round(eta));
        c.setScoreBreakdown(breakdown);
        return c;
    }

    private String buildReason(DispatchCandidate best, OrderState order, DispatchStrategy strategy) {
        return String.format("%s [%s] picked for %s (cost %.1f, eta %.1f)",
                best.getDriverName(), strategy, order.getRestaurantName(), best.getDistance(), best.getEta());
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
