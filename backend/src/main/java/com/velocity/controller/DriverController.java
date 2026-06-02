package com.velocity.controller;

import com.velocity.engine.SimulationEngine;
import com.velocity.model.DriverState;
import com.velocity.model.enums.VehicleType;
import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
public class DriverController {

    private final SimulationEngine engine;
    private final SimulationService simulationService;

    @GetMapping
    public List<DriverState> listDrivers() {
        return engine.driverList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<DriverState> getDriver(@PathVariable String id) {
        DriverState d = engine.driver(id);
        return d != null ? ResponseEntity.ok(d) : ResponseEntity.notFound().build();
    }

    @PostMapping("/deploy")
    public ResponseEntity<DriverState> deploy(@RequestBody Map<String, String> body) {
        VehicleType type = VehicleType.valueOf(body.getOrDefault("vehicleType", "BIKE").toUpperCase());
        DriverState d = simulationService.deployDriver(type);
        return ResponseEntity.ok(d);
    }

    @PostMapping("/{id}/force-offline")
    public ResponseEntity<Map<String, Object>> forceOffline(@PathVariable String id) {
        boolean ok = simulationService.forceOffline(id);
        return ResponseEntity.ok(Map.of("success", ok, "driverId", id));
    }

    @PostMapping("/{id}/bring-online")
    public ResponseEntity<Map<String, Object>> bringOnline(@PathVariable String id) {
        boolean ok = simulationService.bringOnline(id);
        return ResponseEntity.ok(Map.of("success", ok, "driverId", id));
    }

    @PostMapping("/{id}/relocate")
    public ResponseEntity<Map<String, Object>> relocate(@PathVariable String id, @RequestBody Map<String, String> body) {
        String zone = body.getOrDefault("zone", "Downtown");
        boolean ok = simulationService.relocateDriver(id, zone);
        return ResponseEntity.ok(Map.of("success", ok, "driverId", id, "zone", zone));
    }
}
