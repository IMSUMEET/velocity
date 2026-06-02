package com.velocity.controller;

import com.velocity.map.CityMap;
import com.velocity.map.MapModels;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class MapController {

    private final CityMap cityMap;

    @GetMapping
    public Map<String, Object> getMap() {
        return Map.of(
                "nodes", cityMap.getNodes(),
                "edges", cityMap.getEdges(),
                "buildings", cityMap.getBuildings(),
                "zones", cityMap.getZones()
        );
    }
}
