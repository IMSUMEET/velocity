package com.velocity.model;

import lombok.Data;

@Data
public class QueueMetric {
    private String name;
    private int depth;
    private double ingestRate;     // msgs/sec produced
    private double consumeRate;     // msgs/sec consumed
    private int consumerLag;
    private int workers;
    private String health;          // healthy | backpressure | saturated
}
