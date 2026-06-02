package com.velocity.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * A solved batch assignment: one driver, multiple orders, a single merged route.
 */
@Data
public class BatchPlan {
    private String id;
    private String driverId;
    private List<String> orderIds = new ArrayList<>();
    /** Full merged route: driver → pickup1 → pickup2 → ... → drop1 → drop2 → ... */
    private List<String> routeNodes = new ArrayList<>();
    private double totalDistance;
    private double estimatedTime;
    /** Average ticks each order spent in the hold queue before batch was solved. */
    private int holdTicks;
    /** Per-order distances dispatched individually (sum) for savings computation. */
    private double greedyBaselineDistance;
    private double savingsPercent;
    private long createdAt;
}
