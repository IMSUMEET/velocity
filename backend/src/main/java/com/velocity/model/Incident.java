package com.velocity.model;

import com.velocity.model.enums.IncidentType;
import lombok.Data;

@Data
public class Incident {
    private String id;
    private IncidentType type;
    private String severity;          // SEV-1 | SEV-2 | SEV-3
    private String title;
    private String message;
    private String zone;
    private String affectedEdgeId;
    private String affectedBuildingId;
    private String affectedDriverId;
    private long startTick;
    private long durationTicks;
    private long timestamp;
    private boolean mitigated;
    private boolean resolved;
    private String mitigation;
}
