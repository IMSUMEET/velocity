package com.velocity.map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.velocity.map.MapModels.CityMapData;
import com.velocity.map.MapModels.MapBuilding;
import com.velocity.map.MapModels.MapEdge;
import com.velocity.map.MapModels.MapNode;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads the shared city road graph and exposes lookups + adjacency used by
 * pathfinding and the simulation engine. Edge weights can be inflated at
 * runtime by the incident engine to force reroutes.
 */
@Slf4j
@Component
@Getter
public class CityMap {

    public record Adjacency(String nodeId, String edgeId, double cost) {
    }

    private final ObjectMapper objectMapper;

    private List<MapNode> nodes = new ArrayList<>();
    private List<MapEdge> edges = new ArrayList<>();
    private List<MapBuilding> buildings = new ArrayList<>();
    private List<MapModels.MapZone> zones = new ArrayList<>();

    private final Map<String, MapNode> nodeById = new HashMap<>();
    private final Map<String, MapEdge> edgeById = new HashMap<>();
    private final Map<String, List<Adjacency>> adjacency = new HashMap<>();
    private final Map<String, Double> edgeWeightMultiplier = new HashMap<>();

    public CityMap(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void load() {
        try (InputStream in = new ClassPathResource("city-map.json").getInputStream()) {
            CityMapData data = objectMapper.readValue(in, CityMapData.class);
            this.nodes = data.nodes();
            this.edges = data.edges();
            this.buildings = data.buildings();
            this.zones = data.zones();
            buildIndexes();
            log.info("Loaded city map: {} nodes, {} edges, {} buildings, {} zones",
                    nodes.size(), edges.size(), buildings.size(), zones.size());
        } catch (Exception e) {
            log.error("Failed to load city-map.json", e);
            throw new IllegalStateException("city-map.json is required to run the simulation", e);
        }
    }

    private void buildIndexes() {
        nodeById.clear();
        edgeById.clear();
        adjacency.clear();
        for (MapNode n : nodes) {
            nodeById.put(n.id(), n);
            adjacency.put(n.id(), new ArrayList<>());
        }
        for (MapEdge e : edges) {
            edgeById.put(e.id(), e);
            double baseCost = e.distance() * (1 + e.congestion()) / Math.max(e.speedLimit(), 1);
            adjacency.computeIfAbsent(e.from(), k -> new ArrayList<>())
                    .add(new Adjacency(e.to(), e.id(), baseCost));
            adjacency.computeIfAbsent(e.to(), k -> new ArrayList<>())
                    .add(new Adjacency(e.from(), e.id(), baseCost));
        }
    }

    public MapNode node(String id) {
        return nodeById.get(id);
    }

    public MapEdge edge(String id) {
        return edgeById.get(id);
    }

    public List<Adjacency> neighbors(String nodeId) {
        return adjacency.getOrDefault(nodeId, List.of());
    }

    /** Effective cost of an edge including any runtime incident penalty. */
    public double effectiveCost(Adjacency adj) {
        double mult = edgeWeightMultiplier.getOrDefault(adj.edgeId(), 1.0);
        return adj.cost() * mult;
    }

    public void setEdgeMultiplier(String edgeId, double multiplier) {
        edgeWeightMultiplier.put(edgeId, multiplier);
    }

    public void clearEdgeMultiplier(String edgeId) {
        edgeWeightMultiplier.remove(edgeId);
    }

    public double edgeMultiplier(String edgeId) {
        return edgeWeightMultiplier.getOrDefault(edgeId, 1.0);
    }

    public double distanceBetween(String fromNodeId, String toNodeId) {
        MapNode a = nodeById.get(fromNodeId);
        MapNode b = nodeById.get(toNodeId);
        if (a == null || b == null) return 0;
        return Math.hypot(a.x() - b.x(), a.y() - b.y());
    }

    public List<MapBuilding> restaurants() {
        return buildings.stream().filter(b -> "restaurant".equals(b.type())).toList();
    }

    public List<MapBuilding> dropoffs() {
        return buildings.stream()
                .filter(b -> "house".equals(b.type()) || "apartment".equals(b.type()) || "office".equals(b.type()))
                .toList();
    }

    public String zoneForNode(String nodeId) {
        MapNode n = nodeById.get(nodeId);
        return n == null ? "unknown" : n.zone();
    }
}
