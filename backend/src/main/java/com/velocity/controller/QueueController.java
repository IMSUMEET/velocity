package com.velocity.controller;

import com.velocity.model.QueueMetric;
import com.velocity.service.QueueMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/queues")
@RequiredArgsConstructor
public class QueueController {

    private final QueueMetricsService queueMetricsService;

    @GetMapping
    public List<QueueMetric> getQueues() {
        return queueMetricsService.snapshot();
    }
}
