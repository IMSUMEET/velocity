package com.velocity.model;

import com.velocity.model.enums.DispatchStrategy;
import lombok.Data;

/**
 * Captures the outcome of one headless simulation run for a given strategy.
 * Used by the experiment framework to compare dispatch strategies head-to-head.
 */
@Data
public class ExperimentResult {
    private DispatchStrategy strategy;
    private int durationTicks;
    private long seed;

    // Throughput
    private int totalOrdersGenerated;
    private int completedDeliveries;
    private int delayedOrders;
    private double completionRate;

    // Latency (seconds)
    private double p50;
    private double p95;
    private double p99;
    private double avgDeliveryTimeSec;

    // Efficiency
    private double totalFleetMiles;
    private double milesPerDelivery;
    private double driverUtilization;

    // Batching
    private int batchedOrders;
    private double avgBatchSize;
    private double holdTimeAvgMs;
    private double batchSavingsPercent;

    // Customer experience
    private double customerSatisfaction;
    private double revenue;

    // Meta
    private long runDurationMs;
}
