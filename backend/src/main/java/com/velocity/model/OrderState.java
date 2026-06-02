package com.velocity.model;

import com.velocity.model.enums.OrderStatus;
import lombok.Data;

@Data
public class OrderState {
    private String id;
    private String traceId;
    private String customerName;
    private String restaurantName;
    private String restaurantNodeId;
    private String customerNodeId;
    private OrderStatus status;
    private int priority;
    private double estimatedValue;
    private long createdAt;
    private Long assignedAt;
    private Long deliveredAt;
    private String driverId;
    private String mood;
    private Double cookTimeRemaining;
    private Double estimatedPrepTime;
    private Double estimatedDeliveryTime;
    private String delayReason;

    // Batch dispatch fields
    private String batchId;
    private int batchPosition = 0;
    private long holdStartMs = 0;
}
