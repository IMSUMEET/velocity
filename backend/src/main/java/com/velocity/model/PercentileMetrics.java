package com.velocity.model;

import lombok.Data;

@Data
public class PercentileMetrics {
    private double p50;
    private double p95;
    private double p99;
    private int count;
}
