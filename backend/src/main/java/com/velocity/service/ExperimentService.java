package com.velocity.service;

import com.velocity.engine.DispatchEngine;
import com.velocity.engine.SimulationEngine;
import com.velocity.map.CityMap;
import com.velocity.map.Pathfinding;
import com.velocity.model.*;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.model.enums.DriverStatus;
import com.velocity.model.enums.OrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Runs headless (no WebSocket, no Kafka, no DB) simulation experiments with a
 * fixed random seed so all dispatch strategies can be compared under identical
 * arrival sequences. Each call to {@link #runExperiment} creates an isolated
 * SimulationEngine instance that does not affect the live simulation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExperimentService {

    private final CityMap cityMap;
    private final Pathfinding pathfinding;
    private final DispatchEngine dispatchEngine;
    private final EventService eventService;

    // ------------------------------------------------------------- public API

    public ExperimentResult runExperiment(DispatchStrategy strategy, int durationTicks, long seed) {
        long startMs = System.currentTimeMillis();
        log.info("Experiment starting: strategy={} ticks={} seed={}", strategy, durationTicks, seed);

        SimulationEngine engine = buildHeadlessEngine();
        engine.seedWithRandom(new Random(seed));
        engine.setStrategy(strategy);

        for (int t = 0; t < durationTicks; t++) {
            engine.tick(1.0);
        }

        ExperimentResult result = buildResult(engine, strategy, durationTicks, seed,
                System.currentTimeMillis() - startMs);
        log.info("Experiment done: {} completed={} p50={}s", strategy,
                result.getCompletedDeliveries(), result.getP50());
        return result;
    }

    public List<ExperimentResult> runComparison(int durationTicks, long seed) {
        List<ExperimentResult> results = new ArrayList<>();
        for (DispatchStrategy s : DispatchStrategy.values()) {
            try {
                results.add(runExperiment(s, durationTicks, seed));
            } catch (Exception e) {
                log.warn("Experiment failed for strategy {}: {}", s, e.getMessage(), e);
            }
        }
        return results;
    }

    public String exportCsv(List<ExperimentResult> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("strategy,totalOrders,completed,completionRate,p50,p95,p99,avgDeliverySec,")
          .append("totalFleetMiles,milesPerDelivery,driverUtilization,batchedOrders,avgBatchSize,")
          .append("holdTimeAvgMs,batchSavingsPct,customerSatisfaction,revenue,runMs\n");
        for (ExperimentResult r : results) {
            sb.append(r.getStrategy()).append(',')
              .append(r.getTotalOrdersGenerated()).append(',')
              .append(r.getCompletedDeliveries()).append(',')
              .append(fmt(r.getCompletionRate())).append(',')
              .append(fmt(r.getP50())).append(',')
              .append(fmt(r.getP95())).append(',')
              .append(fmt(r.getP99())).append(',')
              .append(fmt(r.getAvgDeliveryTimeSec())).append(',')
              .append(fmt(r.getTotalFleetMiles())).append(',')
              .append(fmt(r.getMilesPerDelivery())).append(',')
              .append(fmt(r.getDriverUtilization())).append(',')
              .append(r.getBatchedOrders()).append(',')
              .append(fmt(r.getAvgBatchSize())).append(',')
              .append(fmt(r.getHoldTimeAvgMs())).append(',')
              .append(fmt(r.getBatchSavingsPercent())).append(',')
              .append(fmt(r.getCustomerSatisfaction())).append(',')
              .append(fmt(r.getRevenue())).append(',')
              .append(r.getRunDurationMs()).append('\n');
        }
        return sb.toString();
    }

    public String exportLatex(List<ExperimentResult> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("\\begin{table}[htbp]\n");
        sb.append("\\centering\n");
        sb.append("\\caption{Dispatch Strategy Comparison: Simulation Results}\n");
        sb.append("\\label{tab:strategy-results}\n");
        sb.append("\\begin{tabular}{lrrrrrrr}\n");
        sb.append("\\hline\n");
        sb.append("\\textbf{Strategy} & \\textbf{Completed} & \\textbf{P50 (s)} & ")
          .append("\\textbf{P95 (s)} & \\textbf{Fleet mi} & \\textbf{mi/del} & ")
          .append("\\textbf{Batch\\%} & \\textbf{Satisf.} \\\\\n");
        sb.append("\\hline\n");
        for (ExperimentResult r : results) {
            double batchPct = r.getTotalOrdersGenerated() > 0
                    ? (double) r.getBatchedOrders() / r.getTotalOrdersGenerated() * 100 : 0;
            sb.append(latexStrategy(r.getStrategy())).append(" & ")
              .append(r.getCompletedDeliveries()).append(" & ")
              .append(fmt(r.getP50())).append(" & ")
              .append(fmt(r.getP95())).append(" & ")
              .append(fmt(r.getTotalFleetMiles())).append(" & ")
              .append(fmt(r.getMilesPerDelivery())).append(" & ")
              .append(fmt(batchPct)).append("\\% & ")
              .append(fmt(r.getCustomerSatisfaction())).append(" \\\\\n");
        }
        sb.append("\\hline\n");
        sb.append("\\end{tabular}\n");
        sb.append("\\end{table}\n");
        return sb.toString();
    }

    // ------------------------------------------------------------- helpers

    /**
     * Creates a fresh SimulationEngine wired to the shared city-map beans but
     * using a no-op EventService so experiments generate zero DB/Kafka/WS traffic.
     */
    private SimulationEngine buildHeadlessEngine() {
        EventService noop = new EventService(null, null, null) {
            @Override
            public PlatformEventDTO record(String type, String category, String severity,
                                           String orderId, String driverId, String traceId,
                                           String message, long tick) {
                return null;
            }

            @Override
            public List<PlatformEventDTO> recent(int limit) { return List.of(); }

            @Override
            public long producedCount() { return 0; }
        };
        return new SimulationEngine(cityMap, pathfinding, dispatchEngine, noop);
    }

    private ExperimentResult buildResult(SimulationEngine engine, DispatchStrategy strategy,
                                          int durationTicks, long seed, long runMs) {
        List<OrderState> allOrders = engine.orderList();
        List<DriverState> allDrivers = engine.driverList();
        List<Double> durations = engine.deliveryDurations();

        int total = engine.getTotalOrdersGenerated();
        int completed = engine.getTotalDeliveries();
        int delayed = (int) allOrders.stream().filter(o -> o.getDelayReason() != null).count();

        List<Double> sorted = new ArrayList<>(durations);
        Collections.sort(sorted);
        double p50 = sorted.isEmpty() ? 0 : sorted.get(Math.max(0, (int)(sorted.size() * 0.50) - 1));
        double p95 = sorted.isEmpty() ? 0 : sorted.get(Math.max(0, (int)(sorted.size() * 0.95) - 1));
        double p99 = sorted.isEmpty() ? 0 : sorted.get(Math.max(0, (int)(sorted.size() * 0.99) - 1));
        double avg = sorted.isEmpty() ? 0 : sorted.stream().mapToDouble(d -> d).average().orElse(0);

        int active = (int) allDrivers.stream().filter(d -> d.getStatus() != DriverStatus.IDLE
                && d.getStatus() != DriverStatus.OFFLINE
                && d.getStatus() != DriverStatus.ON_BREAK).count();
        double util = allDrivers.isEmpty() ? 0 : (double) active / allDrivers.size();

        double revenue = allOrders.stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .mapToDouble(OrderState::getEstimatedValue).sum();
        double satisfaction = Math.max(0, 100 - delayed * 5.0);

        int batched = engine.getBatchedOrders();
        double fleetMiles = engine.getTotalFleetMiles();

        double totalSavings = engine.recentDispatch().stream()
                .filter(a -> a.getBatchId() != null)
                .mapToDouble(DispatchAttempt::getBatchSavingsPercent)
                .average().orElse(0);

        ExperimentResult r = new ExperimentResult();
        r.setStrategy(strategy);
        r.setDurationTicks(durationTicks);
        r.setSeed(seed);
        r.setTotalOrdersGenerated(total);
        r.setCompletedDeliveries(completed);
        r.setDelayedOrders(delayed);
        r.setCompletionRate(total > 0 ? Math.round((double) completed / total * 1000) / 10.0 : 0);
        r.setP50(Math.round(p50 * 10) / 10.0);
        r.setP95(Math.round(p95 * 10) / 10.0);
        r.setP99(Math.round(p99 * 10) / 10.0);
        r.setAvgDeliveryTimeSec(Math.round(avg * 10) / 10.0);
        r.setTotalFleetMiles(Math.round(fleetMiles * 10) / 10.0);
        r.setMilesPerDelivery(completed > 0 ? Math.round(fleetMiles / completed * 100) / 100.0 : 0);
        r.setDriverUtilization(Math.round(util * 1000) / 10.0);
        r.setBatchedOrders(batched);
        r.setAvgBatchSize(Math.round(engine.getAvgBatchSize() * 10) / 10.0);
        r.setHoldTimeAvgMs(Math.round(engine.getAvgHoldTimeMs() * 10) / 10.0);
        r.setBatchSavingsPercent(Math.round(totalSavings * 10) / 10.0);
        r.setCustomerSatisfaction(Math.round(satisfaction * 10) / 10.0);
        r.setRevenue(Math.round(revenue * 100) / 100.0);
        r.setRunDurationMs(runMs);
        return r;
    }

    private String fmt(double v) { return String.format("%.2f", v); }

    private String latexStrategy(DispatchStrategy s) {
        return switch (s) {
            case FASTEST_ETA -> "Fastest ETA";
            case LOWEST_COST -> "Lowest Cost";
            case BALANCED -> "Balanced";
            case BATCH_NEARBY -> "Batch Nearby";
            case BATCH_OPTIMAL -> "Batch Optimal";
        };
    }
}
