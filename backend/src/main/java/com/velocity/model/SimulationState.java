package com.velocity.model;

import com.velocity.model.enums.DispatchStrategy;
import lombok.Data;

@Data
public class SimulationState {
    private boolean running;
    private boolean paused;
    private double speedMultiplier;
    private long tickCount;
    private long elapsedMs;
    private int totalOrdersGenerated;
    private int totalDeliveries;
    private DispatchStrategy dispatchStrategy;
}
