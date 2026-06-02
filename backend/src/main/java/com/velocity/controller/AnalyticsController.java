package com.velocity.controller;

import com.velocity.model.Metrics;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final SimulationService simulationService;

    @GetMapping("/metrics")
    public Metrics currentMetrics() {
        return simulationService.computeMetrics();
    }

    @GetMapping("/strategy-comparison")
    public Map<String, Object> strategyComparison() {
        return Map.of(
                "strategies", DispatchStrategy.values(),
                "currentMetrics", simulationService.computeMetrics(),
                "note", "Run simulation with each strategy and compare over time"
        );
    }
}
