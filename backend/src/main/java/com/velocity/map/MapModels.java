package com.velocity.map;

import java.util.List;

/**
 * Plain data shapes for the city road graph, loaded from {@code city-map.json}.
 * Mirrors the canonical frontend definition in {@code frontend/src/data/cityMap.ts}.
 */
public final class MapModels {

    private MapModels() {
    }

    public record MapNode(String id, double x, double y, String name, String zone) {
    }

    public record MapEdge(String id, String from, String to, double distance,
                          double speedLimit, double congestion, boolean isMajor) {
    }

    public record MapBuilding(String id, String name, String type, String nodeId,
                             double x, double y, String zone, String icon) {
    }

    public record MapZone(String id, String name, double centerX, double centerY,
                         double radius, String color, double labelX, double labelY) {
    }

    public record CityMapData(List<MapNode> nodes, List<MapEdge> edges,
                             List<MapBuilding> buildings, List<MapZone> zones) {
    }
}
