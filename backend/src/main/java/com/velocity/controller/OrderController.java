package com.velocity.controller;

import com.velocity.engine.SimulationEngine;
import com.velocity.model.OrderState;
import com.velocity.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final SimulationEngine engine;
    private final SimulationService simulationService;

    @GetMapping
    public List<OrderState> listOrders() {
        return engine.orderList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderState> getOrder(@PathVariable String id) {
        OrderState o = engine.order(id);
        return o != null ? ResponseEntity.ok(o) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/reassign")
    public ResponseEntity<Map<String, Object>> reassign(@PathVariable String id) {
        boolean ok = simulationService.reassignOrder(id);
        return ResponseEntity.ok(Map.of("success", ok, "orderId", id));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancel(@PathVariable String id) {
        boolean ok = simulationService.cancelOrder(id);
        return ResponseEntity.ok(Map.of("success", ok, "orderId", id));
    }

    @PostMapping("/{id}/priority")
    public ResponseEntity<Map<String, Object>> boostPriority(@PathVariable String id) {
        boolean ok = simulationService.boostPriority(id);
        return ResponseEntity.ok(Map.of("success", ok, "orderId", id));
    }
}
