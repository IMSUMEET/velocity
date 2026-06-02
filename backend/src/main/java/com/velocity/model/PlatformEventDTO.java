package com.velocity.model;

import lombok.Data;

@Data
public class PlatformEventDTO {
    private String id;
    private String type;        // ORDER_CREATED, DISPATCH_MATCHED, PICKUP, DELIVERED, INCIDENT, ...
    private String category;    // order | dispatch | driver | incident | system
    private String severity;    // info | warning | critical
    private String orderId;
    private String driverId;
    private String traceId;
    private String message;
    private long tick;
    private long timestamp;
}
