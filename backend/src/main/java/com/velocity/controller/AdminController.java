package com.velocity.controller;

import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final SimulationService simulationService;

    @PostMapping("/rush-delayed")
    public ResponseEntity<Map<String, Object>> rushDelayed() {
        int count = simulationService.rushDelayed();
        return ResponseEntity.ok(Map.of("boosted", count));
    }

    @PostMapping("/recalculate-routes")
    public ResponseEntity<Map<String, Object>> recalculateRoutes() {
        int count = simulationService.recalculateRoutes();
        return ResponseEntity.ok(Map.of("recomputed", count));
    }
}
