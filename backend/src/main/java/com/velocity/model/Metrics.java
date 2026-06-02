package com.velocity.model;

import lombok.Data;

@Data
public class Metrics {
    private int activeDrivers;
    private int idleDrivers;
    private int totalDrivers;
    private int pendingOrders;
    private int inProgressOrders;
    private double averageEta;
    private int completedDeliveries;
    private int delayedOrders;
    private double driverUtilization;
    private double dispatchSuccessRate;
    private int activeHotspots;
    private int velocityScore;
    private double revenue;
    private PercentileMetrics deliveryPercentiles = new PercentileMetrics();
    private double ordersPerMinute;
    private String networkHealth;       // stable | busy | critical
    private double customerSatisfaction;
    private int activeIncidents;

    // Batch & fleet metrics
    private double totalFleetMiles;
    private double avgBatchSize;
    private int batchedOrders;
    private double milesPerDelivery;
    private double holdTimeAvgMs;
}
