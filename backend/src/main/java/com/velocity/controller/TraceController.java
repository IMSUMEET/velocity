package com.velocity.controller;

import com.velocity.engine.SimulationEngine;
import com.velocity.model.OrderTrace;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/traces")
@RequiredArgsConstructor
public class TraceController {

    private final SimulationEngine engine;

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderTrace> getTrace(@PathVariable String orderId) {
        OrderTrace t = engine.trace(orderId);
        return t != null ? ResponseEntity.ok(t) : ResponseEntity.notFound().build();
    }
}
