package com.velocity.model;

import com.velocity.model.enums.DriverStatus;
import com.velocity.model.enums.VehicleType;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class DriverState {
    private String id;
    private String name;
    private VehicleType vehicleType;
    private DriverStatus status;
    private String currentNodeId;
    private String targetNodeId;
    private double progress;
    private String currentOrderId;
    private List<String> route = new ArrayList<>();
    private int routeIndex;
    private double speed;
    private double rating;
    private int totalDeliveries;
    private int experience;
    private double fatigue;
    private Long breakUntilTick;
    private String statusDetail;
    private String thoughtMessage;
    private Long reroutingUntilTick;

    // Batch dispatch fields
    private List<String> orderBatch = new ArrayList<>();
    private int batchStopIndex = 0;
    private String batchId;
    private int batchSize = 0;
    private double totalMilesDriven = 0;

    /** Ordered stop nodes for segment-by-segment batch routing: [pickup1, pickup2, ..., drop1, drop2, ...] */
    private List<String> batchStopNodes = new ArrayList<>();
}
