package com.velocity.model;

import lombok.Data;

@Data
public class DispatchCandidate {
    private String driverId;
    private String driverName;
    private String vehicleType;
    private double score;
    private double distance;
    private double eta;
    private boolean selected;
    private String rejectReason;
    private ScoreBreakdown scoreBreakdown;
}
