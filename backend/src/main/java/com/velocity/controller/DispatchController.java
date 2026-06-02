package com.velocity.controller;

import com.velocity.engine.SimulationEngine;
import com.velocity.model.DispatchAttempt;
import com.velocity.model.enums.DispatchStrategy;
import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dispatch")
@RequiredArgsConstructor
public class DispatchController {

    private final SimulationEngine engine;
    private final SimulationService simulationService;

    @GetMapping("/attempts")
    public List<DispatchAttempt> listAttempts() {
        return engine.recentDispatch();
    }

    @GetMapping("/attempts/{orderId}")
    public ResponseEntity<DispatchAttempt> attemptForOrder(@PathVariable String orderId) {
        DispatchAttempt a = engine.dispatchForOrder(orderId);
        return a != null ? ResponseEntity.ok(a) : ResponseEntity.notFound().build();
    }

    @GetMapping("/strategies")
    public List<String> strategies() {
        return Arrays.stream(DispatchStrategy.values()).map(Enum::name).toList();
    }

    @PutMapping("/strategy")
    public ResponseEntity<Map<String, String>> setStrategy(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("strategy", "BALANCED").toUpperCase();
        DispatchStrategy s = DispatchStrategy.valueOf(name);
        simulationService.setStrategy(s);
        return ResponseEntity.ok(Map.of("strategy", s.name()));
    }
}
