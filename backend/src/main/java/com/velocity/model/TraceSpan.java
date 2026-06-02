package com.velocity.model;

import lombok.Data;

@Data
public class TraceSpan {
    private String spanId;
    private String service;       // e.g. order-service, dispatch-engine, driver-runtime
    private String operation;     // e.g. order.created, dispatch.matched, pickup.arrived
    private long startOffsetMs;   // relative to trace start
    private long durationMs;
    private String status;        // OK | ERROR | IN_PROGRESS
    private String detail;
}
