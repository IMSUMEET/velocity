package com.velocity.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OrderTrace {
    private String traceId;
    private String orderId;
    private long startTime;
    private long lastUpdate;
    private String currentStatus;
    private List<TraceSpan> spans = new ArrayList<>();
}
