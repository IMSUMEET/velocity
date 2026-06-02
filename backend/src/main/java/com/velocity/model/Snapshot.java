package com.velocity.model;

import lombok.Data;

import java.util.List;

/**
 * Full live state of the platform, broadcast over {@code /topic/snapshot} each
 * tick and also served from {@code GET /api/snapshot} so a refreshing browser
 * resumes from authoritative server state.
 */
@Data
public class Snapshot {
    private SimulationState simulation;
    private Metrics metrics;
    private List<DriverState> drivers;
    private List<OrderState> orders;
    private List<Incident> incidents;
    private List<ZoneHeat> zones;
    private List<QueueMetric> queues;
    private List<DispatchAttempt> recentDispatch;
    private List<PlatformEventDTO> recentEvents;
}
