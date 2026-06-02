package com.velocity.model;

import com.velocity.model.enums.DispatchStrategy;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class DispatchAttempt {
    private String id;
    private String orderId;
    private String restaurantName;
    private DispatchStrategy strategy;
    private String selectedDriverId;
    private String selectedDriverName;
    private double score;
    private String reason;
    private double distance;
    private double eta;
    private int candidatesEvaluated;
    private boolean matched;
    private long timestamp;
    private List<DispatchCandidate> candidates = new ArrayList<>();

    // Batch fields
    private String batchId;
    private int batchSize = 1;
    private double batchSavingsPercent = 0;
}
