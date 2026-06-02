package com.velocity.controller;

import com.velocity.model.SimulationState;
import com.velocity.model.Snapshot;
import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/simulation")
@RequiredArgsConstructor
public class SimulationController {

    private final SimulationService simulationService;

    @PostMapping("/start")
    public ResponseEntity<SimulationState> start() {
        simulationService.start();
        return ResponseEntity.ok(simulationService.buildSimState());
    }

    @PostMapping("/pause")
    public ResponseEntity<SimulationState> pause() {
        simulationService.pause();
        return ResponseEntity.ok(simulationService.buildSimState());
    }

    @PostMapping("/resume")
    public ResponseEntity<SimulationState> resume() {
        simulationService.resume();
        return ResponseEntity.ok(simulationService.buildSimState());
    }

    @PostMapping("/reset")
    public ResponseEntity<SimulationState> reset() {
        simulationService.reset();
        return ResponseEntity.ok(simulationService.buildSimState());
    }

    @PostMapping("/speed")
    public ResponseEntity<SimulationState> setSpeed(@RequestBody Map<String, Double> body) {
        double m = body.getOrDefault("multiplier", 1.0);
        simulationService.setSpeedMultiplier(m);
        return ResponseEntity.ok(simulationService.buildSimState());
    }

    @GetMapping("/state")
    public SimulationState getState() {
        return simulationService.buildSimState();
    }

    @GetMapping("/snapshot")
    public Snapshot getSnapshot() {
        return simulationService.buildSnapshot();
    }
}
