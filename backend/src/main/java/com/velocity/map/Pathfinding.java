package com.velocity.map;

import com.velocity.map.MapModels.MapNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * Dijkstra shortest path over the road graph using a binary-heap priority
 * queue. Costs come from {@link CityMap#effectiveCost}, so live incidents that
 * inflate edge weights automatically push routes around congestion.
 */
@Component
@RequiredArgsConstructor
public class Pathfinding {

    private final CityMap cityMap;

    public record PathResult(List<String> nodeIds, double totalCost, double totalDistance) {
    }

    public PathResult findPath(String startNodeId, String endNodeId) {
        if (startNodeId == null || endNodeId == null) return null;
        if (startNodeId.equals(endNodeId)) {
            return new PathResult(List.of(startNodeId), 0, 0);
        }
        if (cityMap.node(startNodeId) == null || cityMap.node(endNodeId) == null) {
            return null;
        }

        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();
        PriorityQueue<double[]> heap = new PriorityQueue<>((a, b) -> Double.compare(a[1], b[1]));
        Map<Integer, String> idForEntry = new HashMap<>();

        // double[] {entryId, priority}; map entryId -> nodeId to keep heap numeric
        int[] counter = {0};
        dist.put(startNodeId, 0.0);
        pushEntry(heap, idForEntry, counter, startNodeId, 0.0);

        while (!heap.isEmpty()) {
            double[] top = heap.poll();
            String current = idForEntry.get((int) top[0]);
            double priority = top[1];
            if (current == null) continue;
            if (current.equals(endNodeId)) break;
            if (priority > dist.getOrDefault(current, Double.MAX_VALUE)) continue;

            for (CityMap.Adjacency adj : cityMap.neighbors(current)) {
                double newDist = dist.getOrDefault(current, Double.MAX_VALUE) + cityMap.effectiveCost(adj);
                if (newDist < dist.getOrDefault(adj.nodeId(), Double.MAX_VALUE)) {
                    dist.put(adj.nodeId(), newDist);
                    prev.put(adj.nodeId(), current);
                    pushEntry(heap, idForEntry, counter, adj.nodeId(), newDist);
                }
            }
        }

        if (!prev.containsKey(endNodeId)) {
            return null;
        }

        List<String> path = new ArrayList<>();
        String current = endNodeId;
        while (current != null) {
            path.add(current);
            current = prev.get(current);
        }
        Collections.reverse(path);

        double totalCost = dist.getOrDefault(endNodeId, 0.0);
        double totalDistance = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            totalDistance += cityMap.distanceBetween(path.get(i), path.get(i + 1));
        }
        return new PathResult(path, totalCost, totalDistance);
    }

    private void pushEntry(PriorityQueue<double[]> heap, Map<Integer, String> idForEntry,
                           int[] counter, String nodeId, double priority) {
        int id = counter[0]++;
        idForEntry.put(id, nodeId);
        heap.add(new double[]{id, priority});
    }

    public MapNode findNearestNode(double x, double y) {
        MapNode nearest = null;
        double min = Double.MAX_VALUE;
        for (MapNode n : cityMap.getNodes()) {
            double d = Math.hypot(n.x() - x, n.y() - y);
            if (d < min) {
                min = d;
                nearest = n;
            }
        }
        return nearest;
    }
}
