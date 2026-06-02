package com.velocity.controller;

import com.velocity.engine.SimulationEngine;
import com.velocity.model.Incident;
import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final SimulationEngine engine;
    private final SimulationService simulationService;

    @GetMapping
    public List<Incident> listIncidents() {
        return engine.incidentList();
    }

    @PostMapping("/{id}/mitigate")
    public ResponseEntity<Map<String, Object>> mitigate(@PathVariable String id) {
        boolean ok = simulationService.mitigateIncident(id);
        return ResponseEntity.ok(Map.of("success", ok, "incidentId", id));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolve(@PathVariable String id) {
        boolean ok = simulationService.resolveIncident(id);
        return ResponseEntity.ok(Map.of("success", ok, "incidentId", id));
    }
}
